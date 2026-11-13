import { useMemo, useState } from 'react';
import { validateRows, type ValidatedRow } from '../../core/validator';
import type { ColumnMappingConfig, ParsedCsvData } from '../../types/cardsync';
import type { BoardSnapshot } from '../../types/trello';

interface ValidationStepProps {
  csvData: ParsedCsvData;
  mappingConfig: ColumnMappingConfig;
  snapshot: BoardSnapshot;
  onBack: () => void;
  onContinue: (validatedRows: ValidatedRow[]) => void;
}

type FilterTab = 'all' | 'valid' | 'warning' | 'error';

export function ValidationStep({
  csvData,
  mappingConfig,
  snapshot,
  onBack,
  onContinue,
}: ValidationStepProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [skipErrors, setSkipErrors] = useState(true);

  const summary = useMemo(
    () => validateRows(csvData, mappingConfig, snapshot),
    [csvData, mappingConfig, snapshot]
  );

  const listById = useMemo(
    () => new Map(snapshot.lists.map((l) => [l.id, l.name])),
    [snapshot.lists]
  );

  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'valid':
        return summary.validatedRows.filter((r) => r.status === 'valid');
      case 'warning':
        return summary.validatedRows.filter((r) => r.status === 'warning');
      case 'error':
        return summary.validatedRows.filter((r) => r.status === 'error');
      case 'all':
      default:
        return summary.validatedRows;
    }
  }, [summary.validatedRows, filter]);

  // Which rows will actually be passed to Step 4 Preview:
  const targetRowsToUpdate = useMemo(() => {
    if (skipErrors) {
      return summary.safeRows;
    }
    // If not skipping errors and there are errors, nothing can proceed
    return summary.errorCount === 0 ? summary.validatedRows : [];
  }, [skipErrors, summary.safeRows, summary.validatedRows, summary.errorCount]);

  const canProceed = targetRowsToUpdate.length > 0;

  return (
    <section className="cs-card cs-stack-md" aria-labelledby="step3-title">
      {/* Header */}
      <div className="cs-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 id="step3-title" className="cs-card-title">
            Step 3: Validation & Matching
          </h2>
          <p className="cs-card-desc">
            Verified <strong>{summary.totalRows} rows</strong> against your board&apos;s cards, lists, labels, and members.
          </p>
        </div>
      </div>

      {/* Summary KPI Tiles */}
      <div className="cs-stats-grid">
        <div className="cs-stat-tile">
          <div className="cs-label">Total Rows</div>
          <div className="cs-stat-value">{summary.totalRows}</div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Matched & Valid</div>
          <div className="cs-stat-value" style={{ color: 'var(--cs-success)' }}>
            {summary.validCount}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Warnings</div>
          <div
            className="cs-stat-value"
            style={{ color: summary.warningCount > 0 ? 'var(--cs-warning)' : 'inherit' }}
          >
            {summary.warningCount}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Errors (Unmatched)</div>
          <div
            className="cs-stat-value"
            style={{ color: summary.errorCount > 0 ? 'var(--cs-danger)' : 'inherit' }}
          >
            {summary.errorCount}
          </div>
        </div>
      </div>

      {/* Safe Mode Alert Banner */}
      {summary.errorCount > 0 && (
        <div
          className="cs-alert"
          style={{
            background: '#fff8f0',
            border: '1px solid #ffd5a8',
            color: '#974f0c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>{summary.errorCount} row{summary.errorCount === 1 ? '' : 's'} contain errors</strong> (missing or unmatched Card ID, unparseable date, etc.).
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={skipErrors}
              onChange={(e) => setSkipErrors(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Skip invalid rows and update remaining {summary.safeRows.length} cards
          </label>
        </div>
      )}

      {/* Zero Matches Helper Card */}
      {summary.validCount === 0 && summary.errorCount > 0 && (
        <div className="cs-help-box">
          <div className="cs-help-box-title">
            <span>💡</span> Why did cards fail to match?
          </div>
          <p style={{ margin: 0, lineHeight: 1.45 }}>
            Trello cards are identified by their unique <strong>24-character Card ID</strong> (e.g. <code>6a58d5d106fa05b2844281ce</code>), card numbers (like <code>#1</code>, <code>#2</code>), or exact card names. Custom names like <code>CARD-1001</code> do not exist on this board.
          </p>
          <div style={{ marginTop: 4, display: 'flex', gap: 10, alignItems: 'center' }}>
            <strong>Recommended fix:</strong>
            <button
              type="button"
              className="cs-btn cs-btn-sm"
              onClick={onBack}
            >
              &larr; Check Column Mapping
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="cs-row" style={{ alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div className="cs-filter-tabs">
          <button
            type="button"
            className={`cs-filter-btn ${filter === 'all' ? 'cs-filter-btn-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Rows <span className="cs-filter-count">{summary.totalRows}</span>
          </button>
          <button
            type="button"
            className={`cs-filter-btn ${filter === 'valid' ? 'cs-filter-btn-active' : ''}`}
            onClick={() => setFilter('valid')}
          >
            Valid <span className="cs-filter-count">{summary.validCount}</span>
          </button>
          {summary.warningCount > 0 && (
            <button
              type="button"
              className={`cs-filter-btn ${filter === 'warning' ? 'cs-filter-btn-active' : ''}`}
              onClick={() => setFilter('warning')}
            >
              Warnings <span className="cs-filter-count">{summary.warningCount}</span>
            </button>
          )}
          {summary.errorCount > 0 && (
            <button
              type="button"
              className={`cs-filter-btn ${filter === 'error' ? 'cs-filter-btn-active' : ''}`}
              onClick={() => setFilter('error')}
            >
              Errors <span className="cs-filter-count">{summary.errorCount}</span>
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--cs-text-secondary)' }}>
          Showing {filteredRows.length} of {summary.totalRows} rows
        </div>
      </div>

      {/* Validation Results Table */}
      <div className="cs-table-wrap" style={{ maxHeight: 420 }}>
        <table className="cs-table cs-table-validation">
          <thead>
            <tr>
              <th style={{ width: '48px', textAlign: 'center' }}>Row</th>
              <th style={{ width: '92px' }}>Status</th>
              <th style={{ width: '130px' }}>CSV Identifier</th>
              <th style={{ width: '200px' }}>Matched Trello Card</th>
              <th>Validation Details &amp; Issues</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const matched = row.matchedCard;
              const listName = matched?.idList ? listById.get(matched.idList) : undefined;
              const isError = row.status === 'error';

              return (
                <tr key={row.rowNumber} className={isError ? 'cs-row-error' : undefined}>
                  <td className="cs-row-num" style={{ textAlign: 'center' }}>{row.rowNumber}</td>

                  <td>
                    {row.status === 'valid' && (
                      <span className="cs-pill cs-pill-success">
                        <span className="cs-dot" /> Valid
                      </span>
                    )}
                    {row.status === 'warning' && (
                      <span className="cs-pill cs-pill-warning">
                        <span className="cs-dot" /> Warning
                      </span>
                    )}
                    {row.status === 'error' && (
                      <span className="cs-pill" style={{ background: '#ffeceb', color: '#ae2e24' }}>
                        <span className="cs-dot" style={{ background: '#ae2e24' }} /> Error
                      </span>
                    )}
                  </td>

                  <td>
                    <span className="cs-sample-chip" style={{ maxWidth: '120px' }} title={row.idRaw}>
                      {row.idRaw || <span className="cs-cell-empty">(blank)</span>}
                    </span>
                  </td>

                  <td>
                    {matched ? (
                      <div className="cs-matched-card">
                        <div className="cs-matched-card-name" title={matched.name}>
                          {matched.name}
                        </div>
                        <div className="cs-matched-card-meta">
                          {listName ? `List: ${listName}` : ''}
                          {matched.idShort ? ` • #${matched.idShort}` : ''}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--cs-danger)', fontSize: 12, fontWeight: 500 }}>
                        No card found on board
                      </span>
                    )}
                  </td>

                  <td>
                    {row.issues.length === 0 ? (
                      <span style={{ color: 'var(--cs-success)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        ✓ All fields valid &amp; ready to update
                      </span>
                    ) : (
                      <div className="cs-issue-list">
                        {row.issues.map((issue, idx) => {
                          const isErr = issue.severity === 'error';
                          return (
                            <div
                              key={idx}
                              className={`cs-issue-badge ${
                                isErr ? 'cs-issue-badge-error' : 'cs-issue-badge-warning'
                              }`}
                            >
                              <span className="cs-issue-icon">{isErr ? '✕' : '⚠'}</span>
                              <div>
                                <span className="cs-issue-tag">[{issue.field}]:</span>
                                <span>{issue.message}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Navigation Footer */}
      <div className="cs-row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
        <button type="button" className="cs-btn" onClick={onBack}>
          &larr; Back to Column Mapping
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--cs-text-secondary)' }}>
            {canProceed ? (
              <>
                Ready to review <strong>{targetRowsToUpdate.length} card{targetRowsToUpdate.length === 1 ? '' : 's'}</strong>
              </>
            ) : (
              <span style={{ color: 'var(--cs-danger)' }}>
                Cannot proceed: Enable safe mode or fix errors to continue
              </span>
            )}
          </span>

          <button
            type="button"
            className="cs-btn cs-btn-primary"
            disabled={!canProceed}
            onClick={() => onContinue(targetRowsToUpdate)}
          >
            Continue to Step 4: Preview &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}

