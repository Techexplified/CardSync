import { useMemo, useState } from 'react';
import { computeCardDiffs } from '../../core/diff';
import type {
  CardDiff,
  ColumnMappingConfig,
  ParsedCsvData,
} from '../../types/cardsync';
import type { BoardSnapshot } from '../../types/trello';
import type { ValidatedRow } from '../../core/validator';

interface PreviewStepProps {
  validatedRows: ValidatedRow[];
  csvData: ParsedCsvData;
  mappingConfig: ColumnMappingConfig;
  snapshot: BoardSnapshot;
  onBack: () => void;
  onContinue: (selectedCards: CardDiff[]) => void;
}

type PreviewFilter = 'all' | 'changed' | 'unchanged';

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

  // Selection state keyed by cardId
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of initialDiffs) {
      init[d.cardId] = d.selected;
    }
    return init;
  });

  const [filter, setFilter] = useState<PreviewFilter>('all');

  const diffsWithSelection = useMemo(() => {
    return initialDiffs.map((d) => ({
      ...d,
      selected: Boolean(selectedMap[d.cardId]),
    }));
  }, [initialDiffs, selectedMap]);

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
          <button
            type="button"
            className="cs-btn cs-btn-subtle cs-btn-sm"
            onClick={handleSelectOnlyChanged}
            title="Select all cards that have changes and deselect unchanged ones"
          >
            Select Only Changed
          </button>
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
        </div>
      </div>

      {/* Cards Diff List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
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
            const cardClass = `cs-diff-card ${
              isChecked ? 'cs-diff-card-selected' : ''
            } ${!cardDiff.hasChanges ? 'cs-diff-card-nochange' : ''}`;

            return (
              <div key={cardDiff.cardId} className={cardClass}>
                {/* Card Header with Checkbox */}
                <div className="cs-diff-card-header">
                  <div className="cs-diff-card-title-group">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCard(cardDiff.cardId)}
                      id={`card-check-${cardDiff.cardId}`}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`card-check-${cardDiff.cardId}`}
                      className="cs-diff-card-title"
                      style={{ cursor: 'pointer' }}
                      title={cardDiff.cardName}
                    >
                      {cardDiff.cardName}
                    </label>
                    {cardDiff.cardShortId && (
                      <span className="cs-pill cs-pill-muted" style={{ fontSize: 11 }}>
                        #{cardDiff.cardShortId}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--cs-text-muted)' }}>
                      (Row {cardDiff.rowNumber})
                    </span>
                  </div>

                  <div>
                    {cardDiff.hasChanges ? (
                      <span className="cs-pill cs-pill-success">
                        <span className="cs-dot" />
                        {cardDiff.changeCount} change{cardDiff.changeCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="cs-pill cs-pill-muted">No changes (No-Op)</span>
                    )}
                  </div>
                </div>

                {/* Diff Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="cs-diff-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Field</th>
                        <th style={{ width: '36%' }}>Current (Trello)</th>
                        <th style={{ width: '42%' }}>Updated (From CSV)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cardDiff.fieldDiffs.map((field) => (
                        <tr key={field.fieldKey}>
                          <td style={{ fontWeight: 600, color: 'var(--cs-text)' }}>
                            {field.fieldLabel}
                          </td>

                          <td>
                            <span className="cs-diff-val-old" title={field.currentValue}>
                              {field.currentValue}
                            </span>
                          </td>

                          <td>
                            {field.hasChanged ? (
                              <span className="cs-diff-val-new" title={field.newValue}>
                                <span className="cs-diff-arrow">&rarr;</span>
                                {field.newValue}
                              </span>
                            ) : (
                              <span className="cs-diff-val-same">
                                {field.currentValue} (no change)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

