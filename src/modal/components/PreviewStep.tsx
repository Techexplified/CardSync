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

function ArrowRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function formatValue(val: string | null | undefined) {
  if (val === null || val === undefined || val === '') {
    return <span className="cs-diff-val-empty">(empty)</span>;
  }
  return val;
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

  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      init[d.cardId] = d.selected;
    }
    return init;
  });

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      init[d.cardId] = d.hasChanges;
    }
    return init;
  });

  const [filter, setFilter] = useState<PreviewFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
    return diffsWithSelection.filter((d) => {
      if (filter === 'changed' && !d.hasChanges) return false;
      if (filter === 'unchanged' && d.hasChanges) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.cardName?.toLowerCase().includes(q);
        const matchesId = d.cardShortId?.toString().toLowerCase().includes(q);
        const matchesRow = d.rowNumber?.toString() === q;
        const matchesFields = d.fieldDiffs.some(
          (f) =>
            f.fieldLabel.toLowerCase().includes(q) ||
            f.currentValue?.toLowerCase().includes(q) ||
            f.newValue?.toLowerCase().includes(q)
        );
        return matchesName || matchesId || matchesRow || matchesFields;
      }
      return true;
    });
  }, [diffsWithSelection, filter, searchQuery]);

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
      <div className="cs-preview-header">
        <div>
          <h2 id="step4-title" className="cs-card-title">
            Step 4: Review Proposed Updates
          </h2>
          <p className="cs-card-desc">
            Verify before applying updates to Trello. Select which cards to update or uncheck those you wish to skip.
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
          <div className="cs-stat-value cs-stat-value-primary">
            {changedCardsCount}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Unchanged (No-Op)</div>
          <div className="cs-stat-value cs-stat-value-muted">
            {unchangedCardsCount}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Selected To Update</div>
          <div className="cs-stat-value cs-stat-value-success">
            {selectedDiffs.length}
          </div>
        </div>
      </div>

      {/* Zero Changes Helper Notice */}
      {changedCardsCount === 0 && (
        <div className="cs-alert cs-alert-info cs-preview-notice">
          <div>
            <strong>Notice:</strong> All cards in your spreadsheet already match your Trello board. No changes detected.
          </div>
          <button
            type="button"
            className="cs-btn cs-btn-sm"
            onClick={handleSelectAll}
          >
            Select All Anyway
          </button>
        </div>
      )}

      {/* Search and Action Toolbar */}
      <div className="cs-preview-toolbar">
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

        <div className="cs-preview-search-box">
          <input
            type="search"
            className="cs-input cs-preview-search"
            placeholder="Search cards or fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="cs-actions cs-preview-quick-actions">
          {changedCardsCount > 0 && (
            <button
              type="button"
              className="cs-btn cs-btn-subtle cs-btn-sm"
              onClick={handleSelectOnlyChanged}
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
          <div className="cs-divider-v" />
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
      <div className="cs-diff-container">
        {filteredDiffs.length === 0 ? (
          <div className="cs-subbox cs-diff-empty-state">
            <p>No cards match your filter and search criteria.</p>
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
                {/* Header */}
                <div
                  className={`cs-diff-card-header ${
                    cardDiff.hasChanges ? 'cs-diff-card-header-haschanges' : ''
                  }`}
                >
                  <label className="cs-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCard(cardDiff.cardId)}
                      className="cs-checkbox-native"
                    />
                    <span className="cs-custom-checkbox">
                      {isChecked && <CheckIcon />}
                    </span>
                  </label>

                  <div
                    className="cs-diff-card-title-group"
                    onClick={() => handleToggleExpand(cardDiff.cardId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleExpand(cardDiff.cardId);
                      }
                    }}
                  >
                    <span className="cs-diff-card-title">
                      {cardDiff.cardName?.trim() || '(Untitled Card)'}
                    </span>
                    {cardDiff.cardShortId && (
                      <span className="cs-pill cs-pill-muted cs-diff-pill-id">
                        #{cardDiff.cardShortId}
                      </span>
                    )}
                    <span className="cs-diff-row-tag">
                      Row {cardDiff.rowNumber}
                    </span>
                  </div>

                  <div className="cs-diff-header-meta">
                    {cardDiff.hasChanges ? (
                      <span className="cs-pill cs-pill-success">
                        <span className="cs-dot" />
                        {cardDiff.changeCount} change{cardDiff.changeCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="cs-pill cs-pill-muted">No changes</span>
                    )}

                    <button
                      type="button"
                      className="cs-btn cs-btn-subtle cs-btn-sm cs-diff-expand-btn"
                      onClick={() => handleToggleExpand(cardDiff.cardId)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Hide Fields ▲' : `View Fields (${cardDiff.fieldDiffs.length}) ▼`}
                    </button>
                  </div>
                </div>

                {/* Diff Body */}
                {isExpanded && (
                  <div className="cs-diff-body">
                    <div className="cs-diff-grid-header">
                      <span>Field</span>
                      <span>Current in Trello</span>
                      <span aria-hidden="true" />
                      <span>New Value from CSV</span>
                    </div>

                    {cardDiff.fieldDiffs.length === 0 ? (
                      <div className="cs-diff-no-fields">
                        No fields mapped for update on this card.
                      </div>
                    ) : (
                      cardDiff.fieldDiffs.map((field) => (
                        <div
                          key={field.fieldKey}
                          className={`cs-diff-row ${
                            field.hasChanged ? 'cs-diff-row-changed' : 'cs-diff-row-same'
                          }`}
                        >
                          <div className="cs-diff-field-name">
                            {field.fieldLabel}
                          </div>

                          <div className="cs-diff-val-box cs-diff-val-before">
                            {formatValue(field.currentValue)}
                          </div>

                          <div className="cs-diff-arrow">
                            {field.hasChanged ? <ArrowRightIcon /> : '—'}
                          </div>

                          <div className="cs-diff-val-box cs-diff-val-after">
                            {field.hasChanged ? (
                              formatValue(field.newValue)
                            ) : (
                              <span className="cs-diff-val-same">
                                {formatValue(field.currentValue)}{' '}
                                <small>(unchanged)</small>
                              </span>
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
      <div className="cs-preview-footer">
        <button type="button" className="cs-btn" onClick={onBack}>
          ← Back to Validation
        </button>

        <div className="cs-preview-footer-right">
          <span className="cs-preview-summary-text">
            {selectedDiffs.length > 0 ? (
              <>
                <strong>
                  {selectedDiffs.length} card{selectedDiffs.length === 1 ? '' : 's'}
                </strong>{' '}
                selected · <strong>{totalFieldChanges}</strong> field update{totalFieldChanges === 1 ? '' : 's'}
              </>
            ) : (
              <span className="cs-preview-warning-text">
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
            Continue to Step 5: Execution →
          </button>
        </div>
      </div>
    </section>
  );
}