import { useMemo, useState } from 'react';
import { computeCardDiffs } from '../../core/diff';
import type {
  CardDiff,
  ColumnMappingConfig,
  ParsedCsvData,
} from '../../types/cardsync';
import type { BoardSnapshot } from '../../types/trello';
import type { ValidatedRow } from '../../core/validator';
import '../../styles/preview.css';

interface PreviewStepProps {
  validatedRows: ValidatedRow[];
  csvData: ParsedCsvData;
  mappingConfig: ColumnMappingConfig;
  snapshot: BoardSnapshot;
  onBack: () => void;
  onContinue: (selectedCards: CardDiff[]) => void;
}

type PreviewFilter = 'all' | 'changed' | 'unchanged';

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function PreviewStep({
  validatedRows,
  csvData,
  mappingConfig,
  snapshot,
  onBack,
  onContinue,
}: PreviewStepProps) {
  const initialDiffs = useMemo(
    () => computeCardDiffs(validatedRows, csvData, mappingConfig, snapshot),
    [validatedRows, csvData, mappingConfig, snapshot]
  );

  // Selection state keyed by cardId (default: only cards with changes are selected)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      init[d.cardId] = d.selected;
    }
    return init;
  });

  // Accordion state: Cards with changes are expanded by default; unchanged are collapsed
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      init[d.cardId] = d.hasChanges;
    }
    return init;
  });

  const [filter, setFilter] = useState<PreviewFilter>('all');

  const diffsWithSelection = useMemo(() => {
    return initialDiffs.map((d) => ({
      ...d,
      selected: Boolean(selectedMap[d.cardId]),
      isExpanded: Boolean(expandedMap[d.cardId]),
    }));
  }, [initialDiffs, selectedMap, expandedMap]);

  const changedCardsCount = useMemo(
    () => diffsWithSelection.filter((d) => d.hasChanges).length,
    [diffsWithSelection]
  );

  const unchangedCardsCount = useMemo(
    () => diffsWithSelection.filter((d) => !d.hasChanges).length,
    [diffsWithSelection]
  );

  const selectedDiffs = useMemo(
    () => diffsWithSelection.filter((d) => d.selected),
    [diffsWithSelection]
  );

  const totalFieldChanges = useMemo(
    () =>
      selectedDiffs.reduce(
        (sum, d) => sum + d.fieldDiffs.filter((f) => f.hasChanged).length,
        0
      ),
    [selectedDiffs]
  );

  const filteredDiffs = useMemo(() => {
    if (filter === 'changed') {
      return diffsWithSelection.filter((d) => d.hasChanges);
    }
    if (filter === 'unchanged') {
      return diffsWithSelection.filter((d) => !d.hasChanges);
    }
    return diffsWithSelection;
  }, [diffsWithSelection, filter]);

  function handleToggleCard(cardId: string) {
    setSelectedMap((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  }

  function handleToggleExpand(cardId: string) {
    setExpandedMap((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  }

  function handleSelectAll() {
    const next: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      next[d.cardId] = true;
    }
    setSelectedMap(next);
  }

  function handleDeselectAll() {
    const next: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      next[d.cardId] = false;
    }
    setSelectedMap(next);
  }

  function handleSelectOnlyChanged() {
    const next: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      next[d.cardId] = d.hasChanges;
    }
    setSelectedMap(next);
  }

  function handleExpandAll() {
    const next: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      next[d.cardId] = true;
    }
    setExpandedMap(next);
  }

  function handleCollapseAll() {
    const next: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      next[d.cardId] = false;
    }
    setExpandedMap(next);
  }

  return (
    <section className="cs-card cs-stack-md" aria-labelledby="step4-title">
      {/* Top Header */}
      <div className="cs-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 id="step4-title" className="cs-card-title">
            Step 4: Before &amp; After Preview
          </h2>
          <p className="cs-card-desc">
            Compare existing card values against the new values from your spreadsheet. Check or uncheck individual cards to include or exclude them from the sync.
          </p>
        </div>
      </div>

      {/* KPI Stats Tiles */}
      <div className="cs-stats-grid">
        <div className="cs-stat-tile">
          <div className="cs-label">Total Matched Cards</div>
          <div className="cs-stat-value">{diffsWithSelection.length}</div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Cards With Changes</div>
          <div className="cs-stat-value" style={{ color: 'var(--cs-primary)' }}>
            {changedCardsCount}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Unchanged (No-Op)</div>
          <div className="cs-stat-value" style={{ color: 'var(--cs-text-muted)' }}>
            {unchangedCardsCount}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Selected To Update</div>
          <div className="cs-stat-value" style={{ color: 'var(--cs-success)' }}>
            {selectedDiffs.length}
          </div>
        </div>
      </div>

      {/* No-Op Helper Notice when 0 changes are detected */}
      {changedCardsCount === 0 && (
        <div
          className="cs-alert"
          style={{
            background: '#f0f7ff',
            border: '1px solid #b3d4ff',
            color: '#09326c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>Notice:</strong> All {diffsWithSelection.length} cards in your spreadsheet already match your Trello board. No changes were detected.
          </div>
          <button
            type="button"
            className="cs-btn cs-btn-sm"
            onClick={handleSelectAll}
          >
            Select All Cards Anyway
          </button>
        </div>
      )}

      {/* Filter and Quick-Select Toolbar */}
      <div
        className="cs-row"
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div className="cs-filter-tabs">
          <button
            type="button"
            className={`cs-filter-btn ${filter === 'all' ? 'cs-filter-btn-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Cards <span className="cs-filter-count">{diffsWithSelection.length}</span>
          </button>
          <button
            type="button"
            className={`cs-filter-btn ${filter === 'changed' ? 'cs-filter-btn-active' : ''}`}
            onClick={() => setFilter('changed')}
          >
            Has Changes <span className="cs-filter-count">{changedCardsCount}</span>
          </button>
          <button
            type="button"
            className={`cs-filter-btn ${filter === 'unchanged' ? 'cs-filter-btn-active' : ''}`}
            onClick={() => setFilter('unchanged')}
          >
            Unchanged <span className="cs-filter-count">{unchangedCardsCount}</span>
          </button>
        </div>

        <div className="cs-actions" style={{ gap: 6 }}>
          {changedCardsCount > 0 && (
            <button
              type="button"
              className="cs-btn cs-btn-subtle cs-btn-sm"
              onClick={handleSelectOnlyChanged}
              title="Select only cards with changes"
            >
              Select Only Changed
            </button>
          )}
          <button
            type="button"
            className="cs-btn cs-btn-subtle cs-btn-sm"
            onClick={handleSelectAll}
          >
            Select All
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-subtle cs-btn-sm"
            onClick={handleDeselectAll}
          >
            Deselect All
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-subtle cs-btn-sm"
            onClick={handleExpandAll}
          >
            Expand All
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-subtle cs-btn-sm"
            onClick={handleCollapseAll}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Cards Diff List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: 460,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        {filteredDiffs.length === 0 ? (
          <div className="cs-subbox" style={{ textAlign: 'center', padding: '30px 20px' }}>
            <p style={{ color: 'var(--cs-text-secondary)', margin: 0 }}>
              No cards found matching the current filter.
            </p>
          </div>
        ) : (
          filteredDiffs.map((cardDiff) => {
            const isChecked = cardDiff.selected;
            const isExpanded = cardDiff.isExpanded;
            const cardClass = `cs-diff-card ${
              isChecked ? 'cs-diff-card-selected' : ''
            } ${!cardDiff.hasChanges ? 'cs-diff-card-nochange' : ''}`;

            return (
              <div key={cardDiff.cardId} className={cardClass}>
                {/* Card Header with Custom Checkbox */}
                <div
                  className={`cs-diff-card-header ${
                    cardDiff.hasChanges ? 'cs-diff-card-header-haschanges' : ''
                  }`}
                >
                  <div className="cs-checkbox-wrapper">
                    {/* Insulated Custom Checkbox */}
                    <div
                      className={`cs-custom-checkbox ${
                        isChecked ? 'cs-custom-checkbox-checked' : ''
                      }`}
                      onClick={() => handleToggleCard(cardDiff.cardId)}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === ' ' && handleToggleCard(cardDiff.cardId)}
                      title={isChecked ? 'Exclude this card' : 'Include this card'}
                    >
                      {isChecked && <CheckIcon />}
                    </div>

                    <div
                      className="cs-diff-card-title-group"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleToggleCard(cardDiff.cardId)}
                    >
                      <span className="cs-diff-card-title">
                        {cardDiff.cardName?.trim() || '(Untitled Card)'}
                      </span>
                      {cardDiff.cardShortId && (
                        <span className="cs-pill cs-pill-muted" style={{ fontSize: 11 }}>
                          #{cardDiff.cardShortId}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--cs-text-muted)' }}>
                        (Row {cardDiff.rowNumber})
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {cardDiff.hasChanges ? (
                      <span className="cs-pill cs-pill-success">
                        <span className="cs-dot" />
                        {cardDiff.changeCount} change{cardDiff.changeCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="cs-pill cs-pill-muted">No changes (No-Op)</span>
                    )}

                    <button
                      type="button"
                      className="cs-btn cs-btn-subtle cs-btn-sm"
                      onClick={() => handleToggleExpand(cardDiff.cardId)}
                      style={{ padding: '4px 8px', fontSize: 11.5 }}
                    >
                      {isExpanded ? 'Hide Fields ▲' : `View Fields (${cardDiff.fieldDiffs.length}) ▼`}
                    </button>
                  </div>
                </div>

                {/* Diff Grid Body (Expandable) */}
                {isExpanded && (
                  <div className="cs-diff-body">
                    <div className="cs-diff-grid-header">
                      <div>Field</div>
                      <div>Current (In Trello)</div>
                      <div></div>
                      <div>New Value (From CSV)</div>
                    </div>

                    {cardDiff.fieldDiffs.length === 0 ? (
                      <div style={{ color: 'var(--cs-text-muted)', fontSize: 12, padding: '8px 10px' }}>
                        No fields mapped for update on this card.
                      </div>
                    ) : (
                      cardDiff.fieldDiffs.map((field) => (
                        <div
                          key={field.fieldKey}
                          className={`cs-diff-row ${
                            field.hasChanged ? 'cs-diff-row-changed' : ''
                          }`}
                        >
                          <div className="cs-diff-field-name">{field.fieldLabel}</div>

                          <div className="cs-diff-val-before" title={field.currentValue}>
                            {field.currentValue}
                          </div>

                          <div className="cs-diff-arrow">
                            {field.hasChanged ? '➔' : '—'}
                          </div>

                          <div>
                            {field.hasChanged ? (
                              <div className="cs-diff-val-after" title={field.newValue}>
                                {field.newValue}
                              </div>
                            ) : (
                              <div className="cs-diff-val-same">
                                {field.currentValue} (no change)
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Navigation */}
      <div className="cs-row" style={{ marginTop: 12, justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="cs-btn" onClick={onBack}>
          &larr; Back to Validation
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12.5, color: 'var(--cs-text-secondary)' }}>
            {selectedDiffs.length > 0 ? (
              <>
                <strong>{selectedDiffs.length} card{selectedDiffs.length === 1 ? '' : 's'}</strong> selected ({totalFieldChanges} field updates)
              </>
            ) : (
              <span style={{ color: 'var(--cs-warning)', fontWeight: 600 }}>
                No cards selected to update
              </span>
            )}
          </span>

          <button
            type="button"
            className="cs-btn cs-btn-primary"
            disabled={selectedDiffs.length === 0}
            onClick={() => onContinue(selectedDiffs)}
          >
            Continue to Step 5: Execution &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
