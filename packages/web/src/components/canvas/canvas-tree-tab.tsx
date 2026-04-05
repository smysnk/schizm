"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import {
  panSystemCanvasViewBox,
  zoomSystemCanvasViewBoxAtPoint,
  type SystemCanvasViewBox
} from "./system-canvas-camera";
import {
  CANVAS_TREE_DOT_RADIUS,
  buildCanvasTreeDefaultViewBox,
  buildCanvasTreeLayout,
  getCanvasTreeEdgeGeometry,
  getCanvasTreeLineageEdgeIds,
  getCanvasTreeLineageNodeIds
} from "./canvas-tree-layout";
import { buildCanvasTreePromptPlayback } from "./canvas-tree-playback";
import {
  filterCanvasTreeRoots,
  getDefaultCollapsedCanvasTreeNodeIds,
  getCanvasTreeCollapsedDescendantIds,
  getCanvasTreeEmptyState,
  getCanvasTreeRelationRows,
  getVisibleCanvasTreeSnapshot
} from "./canvas-tree-presentation";
import type {
  CanvasTreeLayoutMode,
  CanvasTreeRenderNode,
  CanvasTreeSnapshotRecord
} from "./canvas-tree-types";

type CanvasTreeTabProps = {
  snapshot: CanvasTreeSnapshotRecord | null;
  selectedPromptLabel?: string | null;
  toolbarLead?: React.ReactNode;
  layoutMode?: CanvasTreeLayoutMode;
  playbackEnabled?: boolean;
  rootHistory?: string[];
  onRequestSnapshot?: (
    rootNodeId: string,
    maxDepth: number,
    rootHistory: string[]
  ) => Promise<CanvasTreeSnapshotRecord | null> | CanvasTreeSnapshotRecord | null;
  onChangeLayoutMode?: (mode: CanvasTreeLayoutMode) => void;
  onChangePlaybackEnabled?: (enabled: boolean) => void;
};

const formatLabel = (value: string) => value.replace(/[-_]+/g, " ");

const formatGeneratedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));

const formatRelationshipFamily = (value: string) =>
  value === "tentative-canvas"
    ? "tentative canvas"
    : value === "virtual"
      ? "root"
      : value.replace(/[-_]+/g, " ");

const formatEdgeReasonLabel = ({
  relationshipFamily,
  relationshipReason
}: {
  relationshipFamily: string;
  relationshipReason: string;
}) => {
  if (relationshipFamily === "virtual") {
    return "shared root";
  }

  const normalizedReason = relationshipReason
    .replace(/^tentative canvas edge:\s*/iu, "")
    .replace(/^canvas edge:\s*/iu, "")
    .replace(/^document link from parent note$/iu, "document link")
    .trim();

  return normalizedReason || formatRelationshipFamily(relationshipFamily);
};

const renderRelationCell = (
  cell: ReturnType<typeof getCanvasTreeRelationRows>[number]["parent"],
  {
    onFocusNode,
    onPromoteNode
  }: {
    onFocusNode?: (nodeId: string) => void;
    onPromoteNode?: (nodeId: string) => void;
  }
) => {
  if (!cell) {
    return <span className="tree-surface__relation-card tree-surface__relation-card--empty">None</span>;
  }

  if (cell.kind === "node") {
    return (
      <button
        type="button"
        className={`tree-surface__relation-card tree-surface__relation-card--${cell.kind}`}
        title={cell.tooltip}
        data-node-id={cell.nodeId}
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
          if (event.shiftKey) {
            onPromoteNode?.(cell.nodeId);
            return;
          }

          onFocusNode?.(cell.nodeId);
        }}
      >
        <strong>{cell.label}</strong>
        <small>{cell.summary}</small>
      </button>
    );
  }

  return (
    <span
      className={`tree-surface__relation-card tree-surface__relation-card--${cell.kind}`}
      title={cell.tooltip}
    >
      <strong>{cell.label}</strong>
      <small>{cell.summary}</small>
    </span>
  );
};

const getExpandedNodeIds = ({
  selectedNode,
  visibleSnapshot
}: {
  selectedNode: { id: string } | null;
  visibleSnapshot: CanvasTreeSnapshotRecord | null;
}) =>
  new Set(
    [selectedNode?.id || visibleSnapshot?.rootNodeId || null].filter(
      (value): value is string => Boolean(value)
    )
  );

const getNodeClassName = (
  node: CanvasTreeRenderNode,
  {
    expanded,
    selected,
    lineage,
    dimmed
  }: {
    expanded: boolean;
    selected: boolean;
    lineage: boolean;
    dimmed: boolean;
  }
) =>
  [
    "tree-surface__node",
    expanded ? "tree-surface__node--card" : "tree-surface__node--dot",
    `tree-surface__node--${node.category}`,
    `tree-surface__node--relation-${node.relationshipFamily}`,
    selected ? "tree-surface__node--selected" : "",
    lineage ? "tree-surface__node--lineage" : "",
    node.touchedByPrompt ? "tree-surface__node--touched" : "",
    node.tentative ? "tree-surface__node--tentative" : "",
    dimmed ? "tree-surface__node--dimmed" : ""
  ]
    .filter(Boolean)
    .join(" ");

const getEdgeClassName = ({
  relationshipFamily,
  tentative,
  highlighted,
  dimmed
}: {
  relationshipFamily: string;
  tentative: boolean;
  highlighted: boolean;
  dimmed: boolean;
}) =>
  [
    "tree-surface__edge",
    `tree-surface__edge--${relationshipFamily}`,
    tentative ? "tree-surface__edge--tentative" : "",
    highlighted ? "tree-surface__edge--highlighted" : "",
    dimmed ? "tree-surface__edge--dimmed" : ""
  ]
    .filter(Boolean)
    .join(" ");

const findNode = (snapshot: CanvasTreeSnapshotRecord | null, nodeId: string | null) =>
  snapshot?.nodes.find((node) => node.id === nodeId) || null;

export function CanvasTreeTab({
  snapshot,
  selectedPromptLabel = null,
  toolbarLead = null,
  layoutMode = "phylogeny",
  playbackEnabled = false,
  rootHistory = [],
  onRequestSnapshot,
  onChangeLayoutMode,
  onChangePlaybackEnabled
}: CanvasTreeTabProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: SystemCanvasViewBox;
  } | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState(snapshot);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(snapshot?.rootNodeId || null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [cameraViewBox, setCameraViewBox] = useState<SystemCanvasViewBox | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [activeRootHistory, setActiveRootHistory] = useState<string[]>(rootHistory);
  const [rootSearchQuery, setRootSearchQuery] = useState("");
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<string[]>(
    getDefaultCollapsedCanvasTreeNodeIds(snapshot)
  );

  useEffect(() => {
    setActiveSnapshot(snapshot);
    setSelectedNodeId(snapshot?.rootNodeId || null);
    setHoveredNodeId(null);
    setRequestPending(false);
    setRequestError(null);
    setActiveRootHistory(rootHistory);
    setRootSearchQuery("");
    setCollapsedNodeIds(getDefaultCollapsedCanvasTreeNodeIds(snapshot));
  }, [rootHistory, snapshot]);

  const visibleSnapshot = useMemo(
    () => (activeSnapshot ? getVisibleCanvasTreeSnapshot(activeSnapshot, collapsedNodeIds) : null),
    [activeSnapshot, collapsedNodeIds]
  );
  const layout = useMemo(
    () => (visibleSnapshot ? buildCanvasTreeLayout(visibleSnapshot, layoutMode) : null),
    [layoutMode, visibleSnapshot]
  );
  const defaultViewBox = useMemo(
    () => (layout ? buildCanvasTreeDefaultViewBox(layout) : null),
    [layout]
  );
  const nodeById = useMemo(
    () => new Map(layout?.nodes.map((node) => [node.id, node]) || []),
    [layout]
  );

  useEffect(() => {
    setCameraViewBox(defaultViewBox);
  }, [defaultViewBox]);

  const selectedNode = useMemo(
    () =>
      findNode(visibleSnapshot, selectedNodeId) ||
      findNode(visibleSnapshot, visibleSnapshot?.rootNodeId || null),
    [selectedNodeId, visibleSnapshot]
  );
  const expandedNodeIds = useMemo(
    () => getExpandedNodeIds({ selectedNode, visibleSnapshot }),
    [selectedNode, visibleSnapshot]
  );
  const promptPlayback = useMemo(
    () => buildCanvasTreePromptPlayback(visibleSnapshot),
    [visibleSnapshot]
  );
  const playbackActive = Boolean(
    playbackEnabled && selectedPromptLabel && promptPlayback.touchedNodeCount > 0
  );
  const emphasizedNodeId = useMemo(
    () =>
      playbackActive
        ? null
        : findNode(visibleSnapshot, hoveredNodeId)?.id || selectedNode?.id || null,
    [hoveredNodeId, playbackActive, selectedNode, visibleSnapshot]
  );
  const lineageNodeIds = useMemo(
    () => {
      if (playbackActive) {
        return promptPlayback.highlightedNodeIds;
      }

      return visibleSnapshot && emphasizedNodeId
        ? getCanvasTreeLineageNodeIds(visibleSnapshot, emphasizedNodeId)
        : new Set<string>();
    },
    [emphasizedNodeId, playbackActive, promptPlayback.highlightedNodeIds, visibleSnapshot]
  );
  const lineageEdgeIds = useMemo(
    () => {
      if (playbackActive) {
        return promptPlayback.highlightedEdgeIds;
      }

      return visibleSnapshot && emphasizedNodeId
        ? getCanvasTreeLineageEdgeIds(visibleSnapshot, emphasizedNodeId)
        : new Set<string>();
    },
    [emphasizedNodeId, playbackActive, promptPlayback.highlightedEdgeIds, visibleSnapshot]
  );
  const touchedNodeCount = useMemo(
    () => visibleSnapshot?.nodes.filter((node) => node.touchedByPrompt).length || 0,
    [visibleSnapshot]
  );
  const collapsedDescendantCount = useMemo(
    () => (activeSnapshot ? getCanvasTreeCollapsedDescendantIds(activeSnapshot, collapsedNodeIds).size : 0),
    [activeSnapshot, collapsedNodeIds]
  );
  const filteredRoots = useMemo(
    () => (activeSnapshot ? filterCanvasTreeRoots(activeSnapshot.availableRoots, rootSearchQuery) : []),
    [activeSnapshot, rootSearchQuery]
  );
  const relationRows = useMemo(
    () =>
      getCanvasTreeRelationRows({
        snapshot: activeSnapshot,
        nodeId: selectedNode?.id || activeSnapshot?.rootNodeId || null,
        maxRows: 10
      }),
    [activeSnapshot, selectedNode]
  );
  const rootOptions = useMemo(() => {
    if (!activeSnapshot) {
      return [];
    }

    if (filteredRoots.length > 0) {
      return filteredRoots;
    }

    return activeSnapshot.availableRoots.filter((root) => root.id === activeSnapshot.rootNodeId);
  }, [activeSnapshot, filteredRoots]);
  const emptyState = useMemo(
    () =>
      getCanvasTreeEmptyState({
        snapshot: activeSnapshot,
        visibleSnapshot,
        rootSearchQuery,
        filteredRootsCount: filteredRoots.length
      }),
    [activeSnapshot, filteredRoots.length, rootSearchQuery, visibleSnapshot]
  );
  const resolvedViewBox = cameraViewBox || defaultViewBox;

  const adjustZoom = useCallback(
    (scaleDelta: number) => {
      if (!resolvedViewBox || !viewportRef.current) {
        return;
      }

      const rect = viewportRef.current.getBoundingClientRect();
      setCameraViewBox((current) =>
        zoomSystemCanvasViewBoxAtPoint(
          current || resolvedViewBox,
          { width: rect.width, height: rect.height },
          rect.width / 2,
          rect.height / 2,
          scaleDelta
        )
      );
    },
    [resolvedViewBox]
  );

  const resetView = useCallback(() => {
    setCameraViewBox(defaultViewBox);
  }, [defaultViewBox]);

  const requestSnapshot = useCallback(
    async (rootNodeId: string, maxDepth: number, nextRootHistory: string[]) => {
      if (!onRequestSnapshot) {
        return;
      }

      setRequestPending(true);
      setRequestError(null);

      try {
        const nextSnapshot = await onRequestSnapshot(rootNodeId, maxDepth, nextRootHistory);

        if (nextSnapshot) {
          setActiveSnapshot(nextSnapshot);
          setSelectedNodeId(nextSnapshot.rootNodeId);
          setActiveRootHistory(nextRootHistory);
          setHoveredNodeId(null);
          setCollapsedNodeIds(getDefaultCollapsedCanvasTreeNodeIds(nextSnapshot));
        }
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : "Unable to update tree.");
      } finally {
        setRequestPending(false);
      }
    },
    [onRequestSnapshot]
  );

  const focusTreeNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setHoveredNodeId(nodeId);
  }, []);

  const promoteTreeNodeToRoot = useCallback(
    (nodeId: string) => {
      if (!onRequestSnapshot || !activeSnapshot || requestPending || nodeId === activeSnapshot.rootNodeId) {
        focusTreeNode(nodeId);
        return;
      }

      void requestSnapshot(nodeId, activeSnapshot.maxDepthRequested, [
        ...activeRootHistory,
        activeSnapshot.rootNodeId
      ]);
    },
    [activeRootHistory, activeSnapshot, focusTreeNode, onRequestSnapshot, requestPending, requestSnapshot]
  );

  if (!activeSnapshot) {
    return (
      <section className="tree-surface tree-surface--empty">
        <div className="tree-surface__empty">
          <p className="workspace__eyebrow">Tree</p>
          <p className="panel-copy">Tree of life data is not available yet.</p>
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
        { width: rect.width, height: rect.height },
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
    if (target.closest(".tree-surface__node")) {
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
    setCameraViewBox(
      panSystemCanvasViewBox(
        interaction.origin,
        { width: rect.width, height: rect.height },
        event.clientX - interaction.startX,
        event.clientY - interaction.startY
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

  const relationshipCounts = visibleSnapshot?.summary.relationshipFamilyCounts || activeSnapshot.summary.relationshipFamilyCounts;
  const tentativeCanvasCount =
    relationshipCounts.tentativeCanvas ?? relationshipCounts["tentative-canvas"] ?? 0;
  const selectedNodeRelations = selectedNode
    ? `${formatRelationshipFamily(selectedNode.relationshipFamily)} · ${selectedNode.relationshipReason}`
    : "No selected node";
  const selectedNodeCollapsed = Boolean(selectedNode && collapsedNodeIds.includes(selectedNode.id));

  return (
    <section className="tree-surface tree-surface--fullscreen">
      <div
        ref={viewportRef}
        className="tree-surface__viewport"
        data-panel-open={panelVisible}
        data-panning={isPanning}
        onWheel={handleViewportWheel}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerEnd}
        onPointerCancel={handleViewportPointerEnd}
        onPointerLeave={handleViewportPointerEnd}
      >
        <div className="tree-surface__controls">
          <div className="tree-surface__toolbar">
            {toolbarLead}
            <button
              type="button"
              className="prompt-filter"
              onClick={() => setPanelVisible((current) => !current)}
            >
              {panelVisible ? "Hide details" : "Show details"}
            </button>
            <label className="tree-surface__control">
              <span>Search roots</span>
              <input
                type="search"
                className="graph-surface__select tree-surface__search"
                placeholder="Search notes"
                value={rootSearchQuery}
                onChange={(event) => setRootSearchQuery(event.target.value)}
              />
            </label>
            <label className="tree-surface__control">
              <span>Layout</span>
              <select
                className="graph-surface__select"
                value={layoutMode}
                onChange={(event) =>
                  onChangeLayoutMode?.(event.target.value as CanvasTreeLayoutMode)
                }
              >
                <option value="phylogeny">Phylogeny</option>
                <option value="radial">Radial</option>
              </select>
            </label>
            <label className="tree-surface__control">
              <span>Root</span>
              <select
                className="graph-surface__select"
                value={activeSnapshot.rootNodeId}
                onChange={(event) => {
                  const nextRootId = event.target.value;
                  const nextHistory =
                    nextRootId && nextRootId !== activeSnapshot.rootNodeId
                      ? [...activeRootHistory, activeSnapshot.rootNodeId]
                      : activeRootHistory;
                  void requestSnapshot(nextRootId, activeSnapshot.maxDepthRequested, nextHistory);
                }}
                disabled={!onRequestSnapshot || requestPending}
              >
                {rootOptions.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tree-surface__control">
              <span>Layers deep</span>
              <select
                className="graph-surface__select"
                value={String(activeSnapshot.maxDepthRequested)}
                onChange={(event) =>
                  void requestSnapshot(
                    activeSnapshot.rootNodeId,
                    Number(event.target.value),
                    activeRootHistory
                  )
                }
                disabled={!onRequestSnapshot || requestPending}
              >
                {[1, 2, 3, 4, 5, 6].map((depth) => (
                  <option key={depth} value={depth}>
                    {depth}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="prompt-filter"
            disabled={!onRequestSnapshot || requestPending || activeRootHistory.length === 0}
            onClick={() => {
              if (activeRootHistory.length === 0) {
                return;
              }

              const nextRootId = activeRootHistory[activeRootHistory.length - 1] || activeSnapshot.rootNodeId;
              const nextHistory = activeRootHistory.slice(0, -1);
              void requestSnapshot(nextRootId, activeSnapshot.maxDepthRequested, nextHistory);
            }}
          >
            Back
          </button>
            <button type="button" className="prompt-filter" onClick={() => adjustZoom(0.88)}>
              Zoom in
            </button>
            <button type="button" className="prompt-filter" onClick={() => adjustZoom(1.14)}>
              Zoom out
            </button>
            <button type="button" className="prompt-filter" onClick={resetView}>
              Reset view
            </button>
            {selectedPromptLabel ? (
              <button
                type="button"
                className="prompt-filter"
                data-active={playbackActive}
                disabled={promptPlayback.touchedNodeCount === 0}
                onClick={() => onChangePlaybackEnabled?.(!playbackEnabled)}
              >
                {playbackActive ? "Hide prompt playback" : "Prompt playback"}
              </button>
            ) : null}
          </div>
        </div>

        {emptyState || !visibleSnapshot || !layout ? (
          <div className="tree-surface__empty tree-surface__empty--overlay">
            <p className="workspace__eyebrow">Tree</p>
            <p className="panel-copy">{emptyState?.title || "Tree of life data is not available yet."}</p>
            <p className="tree-surface__empty-detail">
              {emptyState?.detail || "Once the current canvas has graphable nodes, the tree view will appear here."}
            </p>
          </div>
        ) : (
          <>
            <svg
              className="tree-surface__svg"
              viewBox={
                resolvedViewBox
                  ? `${resolvedViewBox.x} ${resolvedViewBox.y} ${resolvedViewBox.width} ${resolvedViewBox.height}`
                  : `0 0 ${layout.width} ${layout.height}`
              }
              role="img"
              aria-label="Canvas tree of life view"
              preserveAspectRatio="xMidYMid meet"
            >
              {layout.mode === "phylogeny" ? (
                <g className="tree-surface__columns">
                  {layout.columns.map((column) => (
                    <g key={column.depth}>
                      <rect
                        className="tree-surface__column"
                        x={column.x}
                        y={16}
                        width={column.width}
                        height={layout.height - 32}
                        rx={22}
                      />
                      <text className="tree-surface__column-label" x={column.x + 16} y={42}>
                        {column.label}
                      </text>
                    </g>
                  ))}
                </g>
              ) : (
                <g className="tree-surface__rings">
                  {layout.rings
                    .filter((ring) => ring.depth > 0)
                    .map((ring) => (
                      <g key={ring.depth}>
                        <circle
                          className="tree-surface__ring"
                          cx={ring.cx}
                          cy={ring.cy}
                          r={ring.radius}
                        />
                        <text
                          className="tree-surface__ring-label"
                          x={ring.cx}
                          y={ring.cy - ring.radius - 14}
                          textAnchor="middle"
                        >
                          {ring.label}
                        </text>
                      </g>
                    ))}
                </g>
              )}

              <g className="tree-surface__edges">
                {layout.edges.map((edge) => {
                  const highlighted = lineageEdgeIds.has(edge.id);
                  const dimmed = Boolean((emphasizedNodeId || playbackActive) && !highlighted);
                  const geometry = getCanvasTreeEdgeGeometry({
                    layout,
                    edge,
                    nodeById,
                    expandedNodeIds
                  });

                  return (
                    <g key={edge.id}>
                      <path
                        className={getEdgeClassName({
                          relationshipFamily: edge.relationshipFamily,
                          tentative: edge.tentative,
                          highlighted,
                          dimmed
                        })}
                        d={geometry.path}
                      />
                      {(highlighted || edge.depth === 1) && !dimmed ? (
                        <text
                          className="tree-surface__edge-label"
                          x={geometry.labelX}
                          y={geometry.labelY}
                          textAnchor="middle"
                        >
                          {formatEdgeReasonLabel({
                            relationshipFamily: edge.relationshipFamily,
                            relationshipReason: edge.relationshipReason
                          })}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>

              <g className="tree-surface__nodes">
                {layout.nodes.map((node) => {
                  const selected = selectedNode?.id === node.id;
                  const lineage = lineageNodeIds.has(node.id);
                  const dimmed = Boolean((emphasizedNodeId || playbackActive) && !lineage);
                  const expanded = expandedNodeIds.has(node.id);

                  return (
                    <g
                      key={node.id}
                      className={getNodeClassName(node, {
                        expanded,
                        selected,
                        lineage,
                        dimmed
                      })}
                      transform={
                        expanded
                          ? `translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`
                          : `translate(${node.x}, ${node.y})`
                      }
                      onClick={() => setSelectedNodeId(node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedNodeId(node.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={node.label}
                      data-collapsed={collapsedNodeIds.includes(node.id)}
                    >
                      {expanded ? (
                        <>
                          <rect
                            className="tree-surface__node-frame"
                            width={node.width}
                            height={node.height}
                            rx={16}
                          />
                          <text className="tree-surface__node-label" x={14} y={24}>
                            {node.label}
                          </text>
                          <text className="tree-surface__node-meta" x={14} y={42}>
                            {formatLabel(node.kind)} · {formatLabel(node.category)}
                          </text>
                          <text className="tree-surface__node-meta" x={14} y={60}>
                            {formatRelationshipFamily(node.relationshipFamily)}
                            {node.touchedByPrompt ? " · touched" : ""}
                          </text>
                        </>
                      ) : (
                        <>
                          <circle
                            className="tree-surface__node-hitarea"
                            cx={0}
                            cy={0}
                            r={18}
                          />
                          <circle
                            className="tree-surface__node-dot"
                            cx={0}
                            cy={0}
                            r={CANVAS_TREE_DOT_RADIUS}
                          />
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {playbackActive ? (
              <aside className="tree-surface__playback">
                <span className="workspace__eyebrow">Prompt playback</span>
                <div className="tree-surface__playback-grid">
                  <span className="tree-surface__playback-item">
                    prompt <strong>{selectedPromptLabel}</strong>
                  </span>
                  <span className="tree-surface__playback-item">
                    touched <strong>{promptPlayback.touchedNodeCount}</strong>
                  </span>
                  <span className="tree-surface__playback-item">
                    branches <strong>{promptPlayback.touchedBranchCount}</strong>
                  </span>
                  <span className="tree-surface__playback-item">
                    leaves <strong>{promptPlayback.touchedLeafCount}</strong>
                  </span>
                  <span className="tree-surface__playback-item">
                    deepest <strong>{promptPlayback.deepestTouchedDepth}</strong>
                  </span>
                  <span className="tree-surface__playback-item">
                    root <strong>{promptPlayback.rootTouched ? "touched" : "untouched"}</strong>
                  </span>
                </div>
              </aside>
            ) : null}

            <aside className="tree-surface__legend tree-surface__legend--dock" tabIndex={0}>
              <div className="tree-surface__legend-peek">
                <span className="workspace__eyebrow">Legend</span>
              </div>
              <div className="tree-surface__legend-panel">
                <div className="tree-surface__legend-group">
                  <span className="workspace__eyebrow">Relationship families</span>
                  <div className="tree-surface__legend-items">
                    <span className="tree-surface__legend-item">
                      <span className="tree-surface__legend-line tree-surface__legend-line--canvas" />
                      Canvas
                    </span>
                    <span className="tree-surface__legend-item">
                      <span className="tree-surface__legend-line tree-surface__legend-line--tentative-canvas" />
                      Tentative canvas
                    </span>
                    <span className="tree-surface__legend-item">
                      <span className="tree-surface__legend-line tree-surface__legend-line--document" />
                      Document
                    </span>
                    <span className="tree-surface__legend-item">
                      <span className="tree-surface__legend-line tree-surface__legend-line--context" />
                      Context
                    </span>
                    <span className="tree-surface__legend-item">
                      <span className="tree-surface__legend-line tree-surface__legend-line--bridge" />
                      Bridge
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {panelVisible ? (
          <aside className="tree-surface__detail-panel">
            <div className="tree-surface__detail-scroll">
              <div className="tree-surface__detail-header">
                <div>
                  <span className="workspace__eyebrow">Selected node</span>
                  <h3>{selectedNode?.label || activeSnapshot.rootLabel}</h3>
                </div>
                {selectedNode && selectedNode.id !== activeSnapshot.rootNodeId && onRequestSnapshot ? (
                  <button
                    type="button"
                    className="lanes-surface__detail-action"
                    onClick={() =>
                      void requestSnapshot(
                        selectedNode.id,
                        activeSnapshot.maxDepthRequested,
                        [...activeRootHistory, activeSnapshot.rootNodeId]
                      )
                    }
                    disabled={requestPending}
                  >
                    Promote as root
                  </button>
                ) : null}
              </div>

              <div className="tree-surface__detail-chips">
                <span className="lanes-surface__chip">{layoutMode}</span>
                <span className="lanes-surface__chip lanes-surface__chip--accent">
                  {formatRelationshipFamily(selectedNode?.relationshipFamily || "root")}
                </span>
                {selectedNode?.tentative ? <span className="lanes-surface__chip">tentative</span> : null}
                {selectedNode?.touchedByPrompt ? <span className="lanes-surface__chip">touched</span> : null}
                {selectedNodeCollapsed ? <span className="lanes-surface__chip">collapsed</span> : null}
              </div>

              <section className="tree-surface__detail-section">
                <div className="tree-surface__detail-grid">
                  <div className="tree-surface__detail-metric">
                    <strong>{selectedNode?.depth ?? 0}</strong>
                    <span>depth</span>
                  </div>
                  <div className="tree-surface__detail-metric">
                    <strong>{selectedNode?.descendantCount ?? activeSnapshot.nodeCount - 1}</strong>
                    <span>descendants</span>
                  </div>
                  <div className="tree-surface__detail-metric">
                    <strong>{selectedNode?.degree ?? 0}</strong>
                    <span>degree</span>
                  </div>
                  <div className="tree-surface__detail-metric">
                    <strong>{selectedNode?.childIds.length ?? 0}</strong>
                    <span>children</span>
                  </div>
                </div>
              </section>

              <section className="tree-surface__detail-section">
                <p className="lanes-surface__detail-label">Lineage reason</p>
                <p className="lanes-surface__detail-copy">{selectedNodeRelations}</p>
              </section>

              <section className="tree-surface__detail-section">
                <div className="tree-surface__relations-header">
                  <p className="lanes-surface__detail-label">Immediate relations</p>
                  <span className="tree-surface__relations-caption">max 10 rows</span>
                </div>
                <div className="tree-surface__relations-wrap">
                  <table className="tree-surface__relations-table">
                    <thead>
                      <tr>
                        <th scope="col">Parent</th>
                        <th scope="col">Child</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relationRows.map((row, index) => (
                        <tr key={`relation-row-${index + 1}`}>
                          <td>
                            {renderRelationCell(row.parent, {
                              onFocusNode: focusTreeNode,
                              onPromoteNode: promoteTreeNodeToRoot
                            })}
                          </td>
                          <td>
                            {renderRelationCell(row.child, {
                              onFocusNode: focusTreeNode,
                              onPromoteNode: promoteTreeNodeToRoot
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {selectedPromptLabel ? (
                <section className="tree-surface__detail-section">
                  <p className="lanes-surface__detail-label">Prompt trace</p>
                  <p className="lanes-surface__detail-copy">
                    {playbackActive
                      ? `Showing ${promptPlayback.touchedNodeCount} touched nodes across ${promptPlayback.highlightedEdgeIds.size} lineage edges.`
                      : "Enable prompt playback to isolate the branches touched by the selected prompt."}
                  </p>
                </section>
              ) : null}

              {selectedNode?.childIds.length ? (
                <section className="tree-surface__detail-section">
                  <button
                    type="button"
                    className="lanes-surface__detail-action"
                    onClick={() =>
                      setCollapsedNodeIds((current) =>
                        current.includes(selectedNode.id)
                          ? current.filter((nodeId) => nodeId !== selectedNode.id)
                          : [...current, selectedNode.id]
                      )
                    }
                  >
                    {selectedNodeCollapsed ? "Expand subtree" : "Collapse subtree"}
                  </button>
                </section>
              ) : null}

              {selectedNode?.notePath ? (
                <section className="tree-surface__detail-section">
                  <p className="lanes-surface__detail-label">Note path</p>
                  <p className="lanes-surface__detail-copy lanes-surface__detail-copy--mono">
                    {selectedNode.notePath}
                  </p>
                </section>
              ) : null}

              <section className="tree-surface__detail-section">
                <p className="lanes-surface__detail-label">Canvas file</p>
                <p className="lanes-surface__detail-copy lanes-surface__detail-copy--mono">
                  {selectedNode?.canvasFile || activeSnapshot.canvasPath}
                </p>
              </section>

              {requestError ? (
                <section className="tree-surface__detail-section">
                  <p className="prompt-detail__error">{requestError}</p>
                </section>
              ) : null}
            </div>
          </aside>
        ) : null}

        <footer className="tree-surface__statusbar">
          <span className="tree-surface__status-item">
            mode <strong>{layoutMode}</strong>
          </span>
          <span className="tree-surface__status-item">
            root <strong>{activeSnapshot.rootLabel}</strong>
          </span>
          <span className="tree-surface__status-item">
            layers <strong>{activeSnapshot.maxDepthRequested}</strong>
          </span>
          <span className="tree-surface__status-item">
            resolved <strong>{activeSnapshot.maxDepthResolved}</strong>
          </span>
          <span className="tree-surface__status-item">
            history <strong>{activeRootHistory.length}</strong>
          </span>
          <span className="tree-surface__status-item">
            collapsed <strong>{collapsedDescendantCount}</strong>
          </span>
          <span className="tree-surface__status-item">
            nodes <strong>{visibleSnapshot?.nodeCount || activeSnapshot.nodeCount}</strong>
          </span>
          <span className="tree-surface__status-item">
            leaves <strong>{visibleSnapshot?.summary.visibleLeafCount || activeSnapshot.summary.visibleLeafCount}</strong>
          </span>
          <span className="tree-surface__status-item">
            hidden <strong>{activeSnapshot.summary.hiddenByDepthCount}</strong>
          </span>
          <span className="tree-surface__status-item">
            touched <strong>{touchedNodeCount}</strong>
          </span>
          {selectedPromptLabel ? (
            <span className="tree-surface__status-item">
              playback <strong>{playbackActive ? "on" : "off"}</strong>
            </span>
          ) : null}
          <span className="tree-surface__status-item">
            direct canvas <strong>{relationshipCounts.canvas}</strong>
          </span>
          <span className="tree-surface__status-item">
            tentative <strong>{tentativeCanvasCount}</strong>
          </span>
          <span className="tree-surface__status-item">
            updated <strong>{formatGeneratedAt(activeSnapshot.generatedAt)}</strong>
          </span>
          {selectedPromptLabel ? (
            <span className="tree-surface__status-item">
              prompt <strong>{selectedPromptLabel}</strong>
            </span>
          ) : null}
        </footer>
      </div>
    </section>
  );
}
