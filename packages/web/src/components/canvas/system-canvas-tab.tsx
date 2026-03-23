"use client";

import { useQuery } from "@apollo/client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import {
  SYSTEM_CANVAS_QUERY,
  type SystemCanvasQueryResponse
} from "../../lib/graphql";
import {
  panSystemCanvasViewBox,
  zoomSystemCanvasViewBoxAtPoint,
  type SystemCanvasViewBox
} from "./system-canvas-camera";
import {
  buildSystemCanvasFocusState,
  buildSystemCanvasFocusViewBox
} from "./system-canvas-focus";
import {
  buildSystemCanvasLayout,
  getSystemCanvasNodeRelations
} from "./system-canvas-layout";
import type {
  SystemCanvasRenderEdge,
  SystemCanvasRenderNode
} from "./system-canvas-types";

type SystemCanvasTabProps = {
  selectedPromptId?: string | null;
};

const formatLabel = (value: string) => value.replace(/[-_]+/g, " ");

const formatToneLabel = (tone: string) => tone.replace(/[-_]+/g, " ");

const formatDurationMs = (durationMs: number | null) => {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "n/a";
  }

  if (durationMs < 1_000) {
    return `${Math.round(durationMs)}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1_000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

const shortenCommand = (value: string | null, maxLength = 44) => {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
};

const getNodeClassName = (
  node: SystemCanvasRenderNode,
  {
    selected,
    related,
    focus
  }: {
    selected: boolean;
    related: boolean;
    focus: boolean;
  }
) =>
  [
    "system-surface__node",
    `system-surface__node--${node.kind}`,
    `system-surface__node--tone-${node.tone}`,
    selected ? "system-surface__node--selected" : "",
    related ? "system-surface__node--related" : "",
    focus ? "system-surface__node--focus" : "",
    node.active ? "system-surface__node--active" : ""
  ]
    .filter(Boolean)
    .join(" ");

const getEdgeClassName = (
  edge: SystemCanvasRenderEdge,
  {
    selected,
    related,
    focus
  }: {
    selected: boolean;
    related: boolean;
    focus: boolean;
  }
) =>
  [
    "system-surface__edge",
    `system-surface__edge--${edge.importance}`,
    selected ? "system-surface__edge--selected" : "",
    related ? "system-surface__edge--related" : "",
    focus ? "system-surface__edge--focus" : "",
    edge.active ? "system-surface__edge--active" : ""
  ]
    .filter(Boolean)
    .join(" ");

const getSelectedPromptSummary = (selectedPrompt: SystemCanvasQueryResponse["systemCanvas"]["selectedPrompt"]) => {
  if (!selectedPrompt) {
    return "No selected prompt";
  }

  return `#${selectedPrompt.id.slice(0, 8)} · ${selectedPrompt.status}`;
};

export function SystemCanvasTab({ selectedPromptId = null }: SystemCanvasTabProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusSelectedNode, setFocusSelectedNode] = useState(false);
  const [focusDepth, setFocusDepth] = useState<1 | 2>(1);
  const [panelVisible, setPanelVisible] = useState(true);
  const [cameraViewBox, setCameraViewBox] = useState<SystemCanvasViewBox | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: SystemCanvasViewBox;
  } | null>(null);
  const { data, loading, error } = useQuery<SystemCanvasQueryResponse>(SYSTEM_CANVAS_QUERY, {
    variables: { selectedPromptId },
    fetchPolicy: "cache-and-network"
  });

  const snapshot = data?.systemCanvas || null;
  const layout = useMemo(() => (snapshot ? buildSystemCanvasLayout(snapshot) : null), [snapshot]);

  useEffect(() => {
    if (!layout) {
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId((current) =>
      current && layout.nodes.some((node) => node.id === current)
        ? current
        : snapshot?.focusNodeIds.find((nodeId) => layout.nodes.some((node) => node.id === nodeId)) ||
          null
    );
  }, [layout, snapshot?.focusNodeIds]);

  const selectedNode = useMemo(
    () => layout?.nodes.find((node) => node.id === selectedNodeId) || null,
    [layout, selectedNodeId]
  );
  const selectedRelations = useMemo(
    () => (snapshot && selectedNode ? getSystemCanvasNodeRelations(snapshot, selectedNode.id) : null),
    [selectedNode, snapshot]
  );
  const adjacentNodeIds = useMemo(() => {
    if (!selectedRelations) {
      return new Set<string>();
    }

    return new Set(
      [
        ...selectedRelations.incoming.map((relation) => relation.node?.id || null),
        ...selectedRelations.outgoing.map((relation) => relation.node?.id || null),
        selectedNode?.id || null
      ].filter((value): value is string => Boolean(value))
    );
  }, [selectedNode?.id, selectedRelations]);
  const adjacentEdgeIds = useMemo(() => {
    if (!selectedRelations) {
      return new Set<string>();
    }

    return new Set([
      ...selectedRelations.incoming.map((relation) => relation.edge.id),
      ...selectedRelations.outgoing.map((relation) => relation.edge.id)
    ]);
  }, [selectedRelations]);
  const focusState = useMemo(
    () =>
      snapshot
        ? buildSystemCanvasFocusState(snapshot, {
            selectedNodeId,
            enabled: focusSelectedNode,
            maxDepth: focusDepth
          })
        : null,
    [focusDepth, focusSelectedNode, selectedNodeId, snapshot]
  );
  const relatedNodeIds = useMemo(
    () =>
      focusSelectedNode && selectedNode
        ? focusState?.focusedNodeIds || new Set<string>()
        : adjacentNodeIds,
    [adjacentNodeIds, focusSelectedNode, focusState, selectedNode]
  );
  const relatedEdgeIds = useMemo(
    () =>
      focusSelectedNode && selectedNode
        ? focusState?.focusedEdgeIds || new Set<string>()
        : adjacentEdgeIds,
    [adjacentEdgeIds, focusSelectedNode, focusState, selectedNode]
  );
  const focusNodeIds = useMemo(
    () => new Set(snapshot?.focusNodeIds || []),
    [snapshot?.focusNodeIds]
  );
  const focusEdgeIds = useMemo(
    () => new Set(snapshot?.focusEdgeIds || []),
    [snapshot?.focusEdgeIds]
  );
  const viewBox = useMemo(
    () =>
      layout && focusState
        ? buildSystemCanvasFocusViewBox(layout, focusState.focusedNodeIds)
        : null,
    [focusState, layout]
  );
  const resolvedViewBox = cameraViewBox || viewBox;
  const traceNodeIds = useMemo(
    () => new Set(snapshot?.selectedPrompt?.routeNodeIds || []),
    [snapshot?.selectedPrompt?.routeNodeIds]
  );
  const traceEdgeIds = useMemo(
    () => new Set(snapshot?.selectedPrompt?.routeEdgeIds || []),
    [snapshot?.selectedPrompt?.routeEdgeIds]
  );

  useEffect(() => {
    if (!selectedNodeId) {
      setFocusSelectedNode(false);
      setFocusDepth(1);
    }
  }, [selectedNodeId]);

  useEffect(() => {
    setCameraViewBox(viewBox);
  }, [viewBox]);

  const adjustZoom = useCallback((scaleDelta: number) => {
    if (!resolvedViewBox || !viewportRef.current) {
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();

    setCameraViewBox((current) =>
      zoomSystemCanvasViewBoxAtPoint(
        current || resolvedViewBox,
        {
          width: rect.width,
          height: rect.height
        },
        rect.width / 2,
        rect.height / 2,
        scaleDelta
      )
    );
  }, [resolvedViewBox]);

  const resetView = useCallback(() => {
    setCameraViewBox(viewBox);
  }, [viewBox]);

  if (loading && !snapshot) {
    return (
      <section className="system-surface system-surface--empty">
        <div className="system-surface__empty">
          <p className="workspace__eyebrow">System</p>
          <p className="panel-copy">Loading system canvas.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="system-surface system-surface--empty">
        <div className="system-surface__empty">
          <p className="workspace__eyebrow">System</p>
          <p className="panel-copy">Unable to load the system canvas right now.</p>
          <p className="prompt-detail__error">{error.message}</p>
        </div>
      </section>
    );
  }

  if (!snapshot || !layout || layout.nodes.length === 0) {
    return (
      <section className="system-surface system-surface--empty">
        <div className="system-surface__empty">
          <p className="workspace__eyebrow">System</p>
          <p className="panel-copy">System topology data is not available yet.</p>
        </div>
      </section>
    );
  }

  const handleViewportWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!resolvedViewBox || !viewportRef.current) {
      return;
    }

    event.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const scaleDelta = event.deltaY < 0 ? 0.88 : 1.14;

    setCameraViewBox((current) =>
      zoomSystemCanvasViewBoxAtPoint(
        current || resolvedViewBox,
        {
          width: rect.width,
          height: rect.height
        },
        pointerX,
        pointerY,
        scaleDelta
      )
    );
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resolvedViewBox || !viewportRef.current) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest(".system-surface__node")) {
      return;
    }

    interactionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: cameraViewBox || resolvedViewBox
    };
    setIsPanning(true);
    viewportRef.current.setPointerCapture(event.pointerId);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !interactionRef.current) {
      return;
    }

    const interaction = interactionRef.current;

    if (interaction.pointerId !== event.pointerId) {
      return;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    setCameraViewBox(
      panSystemCanvasViewBox(
        interaction.origin,
        {
          width: rect.width,
          height: rect.height
        },
        deltaX,
        deltaY
      )
    );
  };

  const handleViewportPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!viewportRef.current || !interactionRef.current) {
      return;
    }

    if (interactionRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (viewportRef.current.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }

    interactionRef.current = null;
    setIsPanning(false);
  };

  return (
    <section className="system-surface system-surface--fullscreen">
      <div
        ref={viewportRef}
        className="system-surface__viewport"
        data-panel-open={panelVisible}
        data-panning={isPanning}
        onWheel={handleViewportWheel}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerEnd}
        onPointerCancel={handleViewportPointerEnd}
        onPointerLeave={handleViewportPointerEnd}
      >
        <div className="system-surface__controls">
          <div className="system-surface__toolbar">
            <button
              type="button"
              className="prompt-filter"
              onClick={() => setPanelVisible((current) => !current)}
            >
              {panelVisible ? "Hide details" : "Show details"}
            </button>
            <button
              type="button"
              className="prompt-filter"
              data-active={focusSelectedNode && Boolean(selectedNode)}
              disabled={!selectedNode}
              onClick={() => setFocusSelectedNode((current) => !current)}
            >
              {focusSelectedNode ? "Show full system" : "Focus selected"}
            </button>
            <button
              type="button"
              className="prompt-filter"
              data-active={focusDepth === 2 && focusSelectedNode && Boolean(selectedNode)}
              disabled={!selectedNode || !focusSelectedNode}
              onClick={() => setFocusDepth((current) => (current === 1 ? 2 : 1))}
            >
              {focusDepth === 2 ? "First-degree only" : "Step out +1"}
            </button>
            <button
              type="button"
              className="prompt-filter"
              disabled={!selectedNode}
              onClick={() => {
                setSelectedNodeId(null);
                setFocusSelectedNode(false);
                setFocusDepth(1);
              }}
            >
              Clear selection
            </button>
            <button
              type="button"
              className="prompt-filter"
              onClick={() => adjustZoom(0.88)}
            >
              Zoom in
            </button>
            <button
              type="button"
              className="prompt-filter"
              onClick={() => adjustZoom(1.14)}
            >
              Zoom out
            </button>
            <button type="button" className="prompt-filter" onClick={resetView}>
              Reset view
            </button>
          </div>
        </div>
        <svg
          className="system-surface__svg"
          viewBox={
            resolvedViewBox
              ? `${resolvedViewBox.x} ${resolvedViewBox.y} ${resolvedViewBox.width} ${resolvedViewBox.height}`
              : `0 0 ${layout.width} ${layout.height}`
          }
          role="img"
          aria-label="Interactive system canvas"
          preserveAspectRatio="xMidYMid meet"
        >
          <g className="system-surface__lanes">
            {layout.lanes.map((lane) => (
              <g key={lane.id}>
                <rect
                  className={`system-surface__lane system-surface__lane--${lane.id}`}
                  x={lane.x}
                  y={0}
                  width={lane.width}
                  height={layout.height}
                  rx={24}
                />
                <text
                  className="system-surface__lane-label"
                  x={lane.x + 18}
                  y={34}
                >
                  {lane.label}
                </text>
              </g>
            ))}
          </g>

          <g className="system-surface__edges">
            {layout.edges.map((edge) => {
              const hidden = Boolean(
                focusSelectedNode && selectedNode && focusState?.hiddenEdgeIds.has(edge.id)
              );
              const isSelected = Boolean(
                selectedNode &&
                  (edge.sourceId === selectedNode.id || edge.targetId === selectedNode.id)
              );
              const isRelated = relatedEdgeIds.has(edge.id);
              const isFocus = focusEdgeIds.has(edge.id);
              const isTrace = traceEdgeIds.has(edge.id);

              return (
                <g key={edge.id}>
                  <path
                    className={getEdgeClassName(edge, {
                      selected: isSelected,
                      related: isRelated,
                      focus: isFocus
                    })}
                    d={edge.path}
                    data-hidden={hidden}
                    data-trace={isTrace}
                  />
                  {!hidden && (edge.importance === "primary" || edge.active || isSelected) ? (
                    <text
                      className="system-surface__edge-label"
                      x={edge.labelX}
                      y={edge.labelY}
                      textAnchor="middle"
                    >
                      {formatLabel(edge.interaction)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>

          <g className="system-surface__nodes">
            {layout.nodes.map((node) => {
              const selected = selectedNode?.id === node.id;
              const related = relatedNodeIds.has(node.id);
              const focus = focusNodeIds.has(node.id);
              const dimmed = Boolean(
                focusSelectedNode && selectedNode && focusState?.dimmedNodeIds.has(node.id)
              );
              const inTrace = traceNodeIds.has(node.id);
              const isCurrentStage = snapshot.selectedPrompt?.currentStageNodeId === node.id;

              return (
                <g
                  key={node.id}
                  className={getNodeClassName(node, { selected, related, focus })}
                  data-dimmed={dimmed}
                  data-trace={inTrace}
                  data-current-stage={isCurrentStage}
                  transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
                  onClick={() => setSelectedNodeId((current) => (current === node.id ? null : node.id))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedNodeId((current) => (current === node.id ? null : node.id));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                >
                  <rect
                    className="system-surface__node-frame"
                    width={node.width}
                    height={node.height}
                    rx={16}
                  />
                  <text className="system-surface__node-label" x={14} y={24}>
                    {node.label}
                  </text>
                  <text className="system-surface__node-meta" x={14} y={42}>
                    {formatLabel(node.kind)}
                    {node.badge ? ` · ${node.badge}` : ""}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <aside className="system-surface__legend">
          <div className="system-surface__legend-group">
            <span className="workspace__eyebrow">Legend</span>
            <div className="system-surface__legend-items">
              <span className="system-surface__legend-item">
                <span className="system-surface__legend-swatch system-surface__legend-swatch--surface" />
                UI surface
              </span>
              <span className="system-surface__legend-item">
                <span className="system-surface__legend-swatch system-surface__legend-swatch--service" />
                Service / control plane
              </span>
              <span className="system-surface__legend-item">
                <span className="system-surface__legend-swatch system-surface__legend-swatch--worker" />
                Worker runtime
              </span>
              <span className="system-surface__legend-item">
                <span className="system-surface__legend-swatch system-surface__legend-swatch--storage" />
                Storage / artifact
              </span>
            </div>
          </div>
        </aside>

        <aside className="system-surface__sidepanel" hidden={!panelVisible}>
          <div className="system-surface__sidepanel-scroll">
            <section className="system-surface__detail prompt-detail">
              {snapshot.selectedPrompt ? (
                <div className="system-surface__trace">
                  <div className="prompt-detail__step-row">
                    <span className="stat-card__label">Selected prompt trace</span>
                    <span className={`prompt-status prompt-status--${snapshot.selectedPrompt.status}`}>
                      {formatLabel(snapshot.selectedPrompt.status)}
                    </span>
                  </div>
                  <p className="prompt-detail__hint">
                    #{snapshot.selectedPrompt.id.slice(0, 8)}
                    {snapshot.selectedPrompt.currentStageNodeId
                      ? ` · ${formatLabel(snapshot.selectedPrompt.currentStageNodeId)}`
                      : ""}
                  </p>
                  <div className="system-surface__trace-grid">
                    {snapshot.selectedPrompt.jobName ? (
                      <span className="system-surface__trace-chip">
                        job {snapshot.selectedPrompt.jobName}
                      </span>
                    ) : null}
                    {snapshot.selectedPrompt.podName ? (
                      <span className="system-surface__trace-chip">
                        pod {snapshot.selectedPrompt.podName}
                      </span>
                    ) : null}
                    {snapshot.selectedPrompt.sha ? (
                      <span className="system-surface__trace-chip">
                        commit {snapshot.selectedPrompt.sha.slice(0, 8)}
                      </span>
                    ) : null}
                    {snapshot.selectedPrompt.queueWaitMs !== null ? (
                      <span className="system-surface__trace-chip">
                        queue {formatDurationMs(snapshot.selectedPrompt.queueWaitMs)}
                      </span>
                    ) : null}
                    {snapshot.selectedPrompt.processingMs !== null ? (
                      <span className="system-surface__trace-chip">
                        work {formatDurationMs(snapshot.selectedPrompt.processingMs)}
                      </span>
                    ) : null}
                  </div>
                  {snapshot.selectedPrompt.latestGitOperation ? (
                    <p className="prompt-detail__hint">
                      Latest git op: {snapshot.selectedPrompt.latestGitOperation}
                    </p>
                  ) : null}
                  {snapshot.selectedPrompt.failureStage ? (
                    <p className="prompt-detail__error">
                      Failure stage: {snapshot.selectedPrompt.failureStage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {selectedNode ? (
                <>
                  <div className="prompt-detail__header">
                    <div>
                      <p className="workspace__eyebrow">Selected component</p>
                      <h3>{selectedNode.label}</h3>
                    </div>
                    <span className={`prompt-status prompt-status--${selectedNode.tone === "error" ? "failed" : selectedNode.tone === "warning" ? "queued" : selectedNode.active ? "writing" : "completed"}`}>
                      {formatToneLabel(selectedNode.tone)}
                    </span>
                  </div>

                  <p className="prompt-detail__content">{selectedNode.description}</p>

                  <div className="prompt-detail__stats">
                    <div className="stat-card">
                      <span className="stat-card__label">Lane</span>
                      <span className="stat-card__value">{formatLabel(selectedNode.lane)}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Kind</span>
                      <span className="stat-card__value">{formatLabel(selectedNode.kind)}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Owner</span>
                      <span className="stat-card__value">{selectedNode.owner}</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Status</span>
                      <span className="stat-card__value">
                        {selectedNode.badge || formatToneLabel(selectedNode.tone)}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Focus scope</span>
                      <span className="stat-card__value">
                        {focusSelectedNode ? `${focusDepth} hop${focusDepth === 1 ? "" : "s"}` : "Full system"}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">On trace</span>
                      <span className="stat-card__value">
                        {traceNodeIds.has(selectedNode.id) ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="prompt-detail__actions">
                    <button
                      type="button"
                      onClick={() => setFocusSelectedNode((current) => !current)}
                    >
                      {focusSelectedNode ? "Show full system" : "Focus this component"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFocusDepth((current) => (current === 1 ? 2 : 1))}
                      disabled={!focusSelectedNode}
                    >
                      {focusDepth === 2 ? "Use first-degree only" : "Step out one more degree"}
                    </button>
                  </div>

                  {traceNodeIds.has(selectedNode.id) ? (
                    <p className="prompt-detail__hint">
                      This component is on the current selected prompt route.
                      {snapshot.selectedPrompt?.currentStageNodeId === selectedNode.id
                        ? " The prompt is currently at this stage."
                        : ""}
                    </p>
                  ) : null}

                  {selectedRelations?.incoming.length ? (
                    <div className="prompt-detail__timeline">
                      <p className="workspace__eyebrow">Reads / listens from</p>
                      {selectedRelations.incoming.map((relation) => (
                        <div className="prompt-detail__step" key={relation.edge.id}>
                          <div className="prompt-detail__step-row">
                            <span className="stat-card__label">
                              {relation.node?.label || relation.edge.sourceId}
                            </span>
                            <span className="prompt-item__time">
                              {formatLabel(relation.edge.interaction)}
                            </span>
                          </div>
                          <p className="prompt-detail__reason">{relation.edge.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedRelations?.outgoing.length ? (
                    <div className="prompt-detail__timeline">
                      <p className="workspace__eyebrow">Writes / emits to</p>
                      {selectedRelations.outgoing.map((relation) => (
                        <div className="prompt-detail__step" key={relation.edge.id}>
                          <div className="prompt-detail__step-row">
                            <span className="stat-card__label">
                              {relation.node?.label || relation.edge.targetId}
                            </span>
                            <span className="prompt-item__time">
                              {formatLabel(relation.edge.interaction)}
                            </span>
                          </div>
                          <p className="prompt-detail__reason">{relation.edge.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedNode.tags.length ? (
                    <p className="prompt-detail__hint">Tags: {selectedNode.tags.join(", ")}</p>
                  ) : null}

                  {Object.keys(selectedNode.metrics).length ? (
                    <div className="prompt-detail__timeline">
                      <p className="workspace__eyebrow">Live runtime data</p>
                      {Object.entries(selectedNode.metrics).map(([key, value]) => (
                        <div className="prompt-detail__step" key={key}>
                          <div className="prompt-detail__step-row">
                            <span className="stat-card__label">{formatLabel(key)}</span>
                          </div>
                          <p className="prompt-detail__reason">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedNode.codeRefs.length ? (
                    <div className="prompt-detail__timeline">
                      <p className="workspace__eyebrow">Relevant files</p>
                      {selectedNode.codeRefs.map((codeRef) => (
                        <div className="prompt-detail__step" key={codeRef}>
                          <p className="prompt-detail__reason">{codeRef}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="prompt-detail__header">
                    <div>
                      <p className="workspace__eyebrow">System overview</p>
                      <h3>Architecture canvas</h3>
                    </div>
                  </div>

                  <p className="prompt-detail__content">
                    This view maps the major runtime surfaces, services, storage layers, worker
                    phases, and document-store artifacts in one system diagram.
                  </p>

                  <div className="prompt-detail__stats">
                    <div className="stat-card">
                      <span className="stat-card__label">Selected prompt</span>
                      <span className="stat-card__value">
                        {getSelectedPromptSummary(snapshot.selectedPrompt)}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Runner state</span>
                      <span className="stat-card__value">
                        {snapshot.summary.activePromptCount > 0 ? "Active flow" : "Idle"}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Generated</span>
                      <span className="stat-card__value">
                        {new Intl.DateTimeFormat(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit"
                        }).format(new Date(snapshot.generatedAt))}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-card__label">Trace nodes</span>
                      <span className="stat-card__value">
                        {snapshot.selectedPrompt?.routeNodeIds.length || 0}
                      </span>
                    </div>
                  </div>

                  <p className="prompt-detail__hint">
                    Select a component to inspect what it reads from, writes to, and how it fits
                    into the live prompt pipeline. Once selected, you can switch into a focused
                    neighborhood view and step out one more degree.
                  </p>
                </>
              )}
            </section>
          </div>
        </aside>

        <div className="system-surface__statusbar">
          <span className="system-surface__status-item">
            nodes <strong>{snapshot.summary.totalNodes}</strong>
          </span>
          <span className="system-surface__status-item">
            edges <strong>{snapshot.summary.totalEdges}</strong>
          </span>
          <span className="system-surface__status-item">
            queued <strong>{snapshot.summary.queuedPromptCount}</strong>
          </span>
          <span className="system-surface__status-item">
            active prompts <strong>{snapshot.summary.activePromptCount}</strong>
          </span>
          <span className="system-surface__status-item">
            active workers <strong>{snapshot.summary.activeExecutionCount}</strong>
          </span>
          <span className="system-surface__status-item">
            failed <strong>{snapshot.summary.failedPromptCount}</strong>
          </span>
          <span className="system-surface__status-item">
            completed <strong>{snapshot.summary.completedPromptCount}</strong>
          </span>
          {snapshot.selectedPrompt ? (
            <>
              <span className="system-surface__status-item">
                prompt <strong>#{snapshot.selectedPrompt.id.slice(0, 8)}</strong>
              </span>
              <span className="system-surface__status-item">
                stage{" "}
                <strong>
                  {snapshot.selectedPrompt.currentStageNodeId
                    ? formatLabel(snapshot.selectedPrompt.currentStageNodeId)
                    : formatLabel(snapshot.selectedPrompt.status)}
                </strong>
              </span>
              {snapshot.selectedPrompt.jobName ? (
                <span className="system-surface__status-item">
                  job <strong>{snapshot.selectedPrompt.jobName}</strong>
                </span>
              ) : null}
              {snapshot.selectedPrompt.sha ? (
                <span className="system-surface__status-item">
                  commit <strong>{snapshot.selectedPrompt.sha.slice(0, 8)}</strong>
                </span>
              ) : null}
              {snapshot.selectedPrompt.latestGitOperation ? (
                <span className="system-surface__status-item">
                  git <strong>{shortenCommand(snapshot.selectedPrompt.latestGitOperation)}</strong>
                </span>
              ) : null}
              {snapshot.selectedPrompt.queueWaitMs !== null ? (
                <span className="system-surface__status-item">
                  queue <strong>{formatDurationMs(snapshot.selectedPrompt.queueWaitMs)}</strong>
                </span>
              ) : null}
              {snapshot.selectedPrompt.processingMs !== null ? (
                <span className="system-surface__status-item">
                  work <strong>{formatDurationMs(snapshot.selectedPrompt.processingMs)}</strong>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
