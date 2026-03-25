"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  buildCanvasLanesBackRequest,
  buildCanvasLanesFocusRequest,
  buildCanvasLanesResetRequest
} from "./canvas-lanes-navigation";
import {
  findCanvasLaneCard,
  formatCanvasLaneReasonFamily,
  getCanvasLaneRelatedNodeIds,
  getVisibleCanvasLanes
} from "./canvas-lanes-presentation";
import type {
  CanvasLaneCardRecord,
  CanvasLaneRecord,
  CanvasLanesSnapshotRecord
} from "./canvas-lanes-types";

type CanvasLanesTabProps = {
  snapshot: CanvasLanesSnapshotRecord | null;
  selectedPromptLabel?: string | null;
  toolbarLead?: React.ReactNode;
  onRequestSnapshot?: (
    focusNodeId: string,
    focusHistory: string[]
  ) => Promise<CanvasLanesSnapshotRecord | null> | CanvasLanesSnapshotRecord | null;
};

const formatLabel = (value: string) => value.replace(/[-_]+/g, " ");

const formatGeneratedAt = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));

const formatCategory = (value: string) => value.replace(/[-_]+/g, " ");

const getCardClassName = ({
  card,
  isFocusCard,
  isSelected,
  isHovered,
  isDimmed
}: {
  card: CanvasLaneCardRecord;
  isFocusCard: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
}) =>
  [
    "lanes-surface__card",
    isFocusCard ? "lanes-surface__card--focus" : "lanes-surface__card--linked",
    `lanes-surface__card--${card.category}`,
    card.tentative ? "lanes-surface__card--tentative" : "",
    card.touchedByPrompt ? "lanes-surface__card--touched" : "",
    isSelected ? "lanes-surface__card--selected" : "",
    isHovered ? "lanes-surface__card--hovered" : "",
    isDimmed ? "lanes-surface__card--dimmed" : ""
  ]
    .filter(Boolean)
    .join(" ");

type RenderCardArgs = {
  card: CanvasLaneCardRecord;
  lane: CanvasLaneRecord;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  onHoverChange: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
  onPromote?: (nodeId: string) => void;
  disabled?: boolean;
};

const renderCard = ({
  card,
  lane,
  isSelected,
  isHovered,
  isDimmed,
  onHoverChange,
  onSelect,
  onPromote,
  disabled = false
}: RenderCardArgs) => {
  const isFocusCard = lane.id === "focus";
  const className = getCardClassName({
    card,
    isFocusCard,
    isSelected,
    isHovered,
    isDimmed
  });
  const content = (
    <article className={className}>
      <div className="lanes-surface__card-header">
        <div>
          <p className="lanes-surface__card-title">{card.label}</p>
          <p className="lanes-surface__card-meta">
            {formatLabel(card.kind)} · {formatCategory(card.category)}
          </p>
        </div>
        <div className="lanes-surface__card-chips">
          <span className="lanes-surface__chip lanes-surface__chip--accent">
            {formatCanvasLaneReasonFamily(card.reason)}
          </span>
          {card.tentative ? <span className="lanes-surface__chip">tentative</span> : null}
          {card.touchedByPrompt ? <span className="lanes-surface__chip">touched</span> : null}
        </div>
      </div>

      <p className="lanes-surface__card-reason">{card.reason}</p>

      <div className="lanes-surface__card-footer">
        <span className="lanes-surface__card-score">score {card.score.toFixed(2)}</span>
        {card.notePath ? (
          <span className="lanes-surface__card-path">{card.notePath}</span>
        ) : card.canvasNodeId ? (
          <span className="lanes-surface__card-path">{card.canvasNodeId}</span>
        ) : null}
      </div>
    </article>
  );

  if (isFocusCard) {
    return (
      <div
        key={card.nodeId}
        className="lanes-surface__card-button lanes-surface__card-button--static"
        role="button"
        tabIndex={0}
        onMouseEnter={() => onHoverChange(card.nodeId)}
        onMouseLeave={() => onHoverChange(null)}
        onFocus={() => onSelect(card.nodeId)}
        onClick={() => onSelect(card.nodeId)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(card.nodeId);
          }
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      key={card.nodeId}
      type="button"
      className="lanes-surface__card-button"
      onMouseEnter={() => onHoverChange(card.nodeId)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onSelect(card.nodeId)}
      onClick={() => {
        onSelect(card.nodeId);
        onPromote?.(card.nodeId);
      }}
      disabled={disabled}
    >
      {content}
    </button>
  );
};

export function CanvasLanesTab({
  snapshot,
  selectedPromptLabel = null,
  toolbarLead = null,
  onRequestSnapshot
}: CanvasLanesTabProps) {
  const [activeSnapshot, setActiveSnapshot] = useState(snapshot);
  const [initialFocusNodeId, setInitialFocusNodeId] = useState<string | null>(
    snapshot?.focusNodeId || null
  );
  const [selectedCardNodeId, setSelectedCardNodeId] = useState<string | null>(
    snapshot?.focusNodeId || null
  );
  const [hoveredCardNodeId, setHoveredCardNodeId] = useState<string | null>(null);
  const [loadingNavigation, setLoadingNavigation] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  useEffect(() => {
    setActiveSnapshot(snapshot);
    setInitialFocusNodeId(snapshot?.focusNodeId || null);
    setSelectedCardNodeId(snapshot?.focusNodeId || null);
    setHoveredCardNodeId(null);
    setLoadingNavigation(false);
    setNavigationError(null);
  }, [snapshot]);

  const handleFocusRequest = async (focusNodeId: string) => {
    if (!activeSnapshot || !onRequestSnapshot) {
      return;
    }

    const request = buildCanvasLanesFocusRequest(activeSnapshot, focusNodeId);

    if (!request) {
      return;
    }

    setLoadingNavigation(true);
    setNavigationError(null);

    try {
      const nextSnapshot = await onRequestSnapshot(request.focusNodeId, request.focusHistory);

      if (nextSnapshot) {
        setActiveSnapshot(nextSnapshot);
        setSelectedCardNodeId(nextSnapshot.focusNodeId);
        setHoveredCardNodeId(null);
      }
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : "Unable to load lane focus.");
    } finally {
      setLoadingNavigation(false);
    }
  };

  const handleBack = async () => {
    if (!activeSnapshot || !onRequestSnapshot) {
      return;
    }

    const request = buildCanvasLanesBackRequest(activeSnapshot);

    if (!request) {
      return;
    }

    setLoadingNavigation(true);
    setNavigationError(null);

    try {
      const nextSnapshot = await onRequestSnapshot(request.focusNodeId, request.focusHistory);

      if (nextSnapshot) {
        setActiveSnapshot(nextSnapshot);
        setSelectedCardNodeId(nextSnapshot.focusNodeId);
        setHoveredCardNodeId(null);
      }
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : "Unable to step back.");
    } finally {
      setLoadingNavigation(false);
    }
  };

  const handleReset = async () => {
    if (!onRequestSnapshot) {
      return;
    }

    const request = buildCanvasLanesResetRequest(initialFocusNodeId);

    if (!request) {
      return;
    }

    setLoadingNavigation(true);
    setNavigationError(null);

    try {
      const nextSnapshot = await onRequestSnapshot(request.focusNodeId, request.focusHistory);

      if (nextSnapshot) {
        setActiveSnapshot(nextSnapshot);
        setSelectedCardNodeId(nextSnapshot.focusNodeId);
        setHoveredCardNodeId(null);
      }
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : "Unable to reset lane focus.");
    } finally {
      setLoadingNavigation(false);
    }
  };

  const hasSnapshot = Boolean(activeSnapshot && activeSnapshot.lanes.length > 0);
  const visibleLanes = activeSnapshot ? getVisibleCanvasLanes(activeSnapshot) : [];
  const focusLane = visibleLanes[0] || null;
  const focusCard = focusLane?.cards[0] || null;
  const downstreamLanes = visibleLanes.slice(1);
  const totalCards = activeSnapshot
    ? activeSnapshot.lanes.reduce((sum, lane) => sum + lane.cards.length, 0)
    : 0;
  const hiddenLaneCount = activeSnapshot ? activeSnapshot.lanes.length - visibleLanes.length : 0;
  const touchedCardCount = activeSnapshot
    ? activeSnapshot.lanes.reduce(
        (sum, lane) => sum + lane.cards.filter((card) => card.touchedByPrompt).length,
        0
      )
    : 0;

  const detailNodeId = hoveredCardNodeId || selectedCardNodeId || focusCard?.nodeId || null;
  const detailEntry = activeSnapshot
    ? findCanvasLaneCard(activeSnapshot, detailNodeId) ||
      findCanvasLaneCard(activeSnapshot, focusCard?.nodeId || null)
    : null;
  const relatedNodeIds = useMemo(
    () =>
      hasSnapshot && activeSnapshot
        ? getCanvasLaneRelatedNodeIds(
            activeSnapshot,
            focusCard?.nodeId || activeSnapshot.focusNodeId,
            detailNodeId
          )
        : null,
    [activeSnapshot, detailNodeId, focusCard?.nodeId, hasSnapshot]
  );

  const selectedRelationCount =
    detailEntry && relatedNodeIds ? Math.max(relatedNodeIds.size - 1, 0) : 0;

  const renderInteractiveCard = (card: CanvasLaneCardRecord, lane: CanvasLaneRecord) => {
    const isSelected = card.nodeId === selectedCardNodeId;
    const isHovered = card.nodeId === hoveredCardNodeId;
    const shouldDim =
      !!relatedNodeIds &&
      !relatedNodeIds.has(card.nodeId) &&
      card.nodeId !== focusCard?.nodeId;

    return renderCard({
      card,
      lane,
      isSelected,
      isHovered,
      isDimmed: shouldDim,
      onHoverChange: setHoveredCardNodeId,
      onSelect: setSelectedCardNodeId,
      onPromote: lane.id === "focus" ? undefined : (nodeId) => void handleFocusRequest(nodeId),
      disabled: loadingNavigation
    });
  };

  if (!hasSnapshot || !activeSnapshot || !focusLane) {
    return (
      <section className="lanes-surface lanes-surface--empty">
        <div className="lanes-surface__empty">
          <p className="workspace__eyebrow">Lanes</p>
          <p className="panel-copy">No lane snapshot is available yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="lanes-surface lanes-surface--fullscreen">
      <div className="lanes-surface__viewport">
        <div className="lanes-surface__controls">
          <div className="lanes-surface__toolbar">
            {toolbarLead}
            <button
              type="button"
              className="prompt-filter"
              onClick={() => void handleBack()}
              disabled={
                !onRequestSnapshot || activeSnapshot.focusHistory.length === 0 || loadingNavigation
              }
            >
              Back
            </button>
            <button
              type="button"
              className="prompt-filter"
              onClick={() => void handleReset()}
              disabled={
                !onRequestSnapshot ||
                !initialFocusNodeId ||
                activeSnapshot.focusNodeId === initialFocusNodeId ||
                loadingNavigation
              }
            >
              Reset focus
            </button>
            {loadingNavigation ? (
              <span className="lanes-surface__toolbar-note">Loading focus…</span>
            ) : null}
            {navigationError ? (
              <span className="lanes-surface__toolbar-note lanes-surface__toolbar-note--error">
                {navigationError}
              </span>
            ) : null}
          </div>
        </div>

        <div className="lanes-surface__columns" role="list" aria-label="Canvas lanes">
          <section className="lanes-surface__lane lanes-surface__lane--focus" role="listitem">
            <header className="lanes-surface__lane-header">
              <p className="workspace__eyebrow">{focusLane.label}</p>
              <h3>{focusCard?.label || "Main frame"}</h3>
              <p className="panel-copy">{focusLane.description}</p>
              {selectedPromptLabel ? (
                <div className="lanes-surface__prompt-trace">
                  <span className="lanes-surface__chip">prompt {selectedPromptLabel}</span>
                  <span className="lanes-surface__chip">touched {touchedCardCount}</span>
                  {focusCard?.touchedByPrompt ? (
                    <span className="lanes-surface__chip">focus touched</span>
                  ) : null}
                </div>
              ) : null}
            </header>
            <div className="lanes-surface__lane-scroll">
              {focusLane.cards.map((card) => renderInteractiveCard(card, focusLane))}
            </div>
          </section>

          {downstreamLanes.map((lane) => (
            <section className="lanes-surface__lane" key={lane.id} role="listitem">
              <header className="lanes-surface__lane-header">
                <div className="lanes-surface__lane-title-row">
                  <p className="workspace__eyebrow">{lane.label}</p>
                  <span className="lanes-surface__lane-count">{lane.cards.length}</span>
                </div>
                <p className="panel-copy">{lane.description}</p>
              </header>

              <div className="lanes-surface__lane-scroll">
                {lane.cards.map((card) => renderInteractiveCard(card, lane))}
              </div>
            </section>
          ))}
        </div>

        {detailEntry ? (
          <aside className="lanes-surface__detail-panel" aria-label="Selected lane card details">
            <div className="lanes-surface__detail-scroll">
              <header className="lanes-surface__detail-header">
                <p className="workspace__eyebrow">Selected card</p>
                <h3>{detailEntry.card.label}</h3>
                <p className="panel-copy">
                  {detailEntry.lane.label} · {formatLabel(detailEntry.card.kind)} ·{" "}
                  {formatCategory(detailEntry.card.category)}
                </p>
              </header>

              <div className="lanes-surface__detail-chips">
                <span className="lanes-surface__chip lanes-surface__chip--accent">
                  {formatCanvasLaneReasonFamily(detailEntry.card.reason)}
                </span>
                <span className="lanes-surface__chip">
                  score {detailEntry.card.score.toFixed(2)}
                </span>
                {detailEntry.card.tentative ? (
                  <span className="lanes-surface__chip">tentative</span>
                ) : null}
                {detailEntry.card.touchedByPrompt ? (
                  <span className="lanes-surface__chip">touched by prompt</span>
                ) : null}
              </div>

              <div className="lanes-surface__detail-section">
                <span className="lanes-surface__detail-label">Why it is here</span>
                <p className="lanes-surface__detail-copy">{detailEntry.card.reason}</p>
              </div>

              <div className="lanes-surface__detail-grid">
                <div className="lanes-surface__detail-metric">
                  <span className="lanes-surface__detail-label">Related cards</span>
                  <strong>{selectedRelationCount}</strong>
                </div>
                <div className="lanes-surface__detail-metric">
                  <span className="lanes-surface__detail-label">Lane</span>
                  <strong>{detailEntry.lane.label}</strong>
                </div>
              </div>

              {detailEntry.card.notePath || detailEntry.card.canvasNodeId ? (
                <div className="lanes-surface__detail-section">
                  <span className="lanes-surface__detail-label">Reference</span>
                  <p className="lanes-surface__detail-copy lanes-surface__detail-copy--mono">
                    {detailEntry.card.notePath || detailEntry.card.canvasNodeId}
                  </p>
                </div>
              ) : null}

              {detailEntry.card.nodeId !== focusCard?.nodeId && onRequestSnapshot ? (
                <button
                  type="button"
                  className="prompt-filter lanes-surface__detail-action"
                  onClick={() => void handleFocusRequest(detailEntry.card.nodeId)}
                  disabled={loadingNavigation}
                >
                  Promote to main frame
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}

        <footer className="lanes-surface__statusbar">
          <span className="lanes-surface__status-item">
            canvas <strong>{activeSnapshot.canvasPath}</strong>
          </span>
          <span className="lanes-surface__status-item">
            focus <strong>{focusCard?.label || activeSnapshot.focusNodeId}</strong>
          </span>
          <span className="lanes-surface__status-item">
            lanes <strong>{visibleLanes.length}</strong>
          </span>
          {hiddenLaneCount > 0 ? (
            <span className="lanes-surface__status-item">
              collapsed <strong>{hiddenLaneCount}</strong>
            </span>
          ) : null}
          <span className="lanes-surface__status-item">
            cards <strong>{totalCards}</strong>
          </span>
          <span className="lanes-surface__status-item">
            history <strong>{activeSnapshot.focusHistory.length}</strong>
          </span>
          <span className="lanes-surface__status-item">
            generated <strong>{formatGeneratedAt(activeSnapshot.generatedAt)}</strong>
          </span>
          {selectedPromptLabel ? (
            <span className="lanes-surface__status-item">
              prompt <strong>{selectedPromptLabel}</strong>
            </span>
          ) : null}
        </footer>
      </div>
    </section>
  );
}
