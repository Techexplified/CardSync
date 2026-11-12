import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { exportBoardTemplateCsv, parseCsvFile } from '../../core/csv';
import type { ParsedCsvData } from '../../types/cardsync';
import type { BoardSnapshot } from '../../types/trello';

interface UploadStepProps {
  snapshot: BoardSnapshot | null;
  snapshotLoading: boolean;
  snapshotError: string | null;
  csvData: ParsedCsvData | null;
  onRefreshBoard: () => Promise<void>;
  onCsvLoaded: (data: ParsedCsvData) => void;
  onContinue: () => void;
}

const PREVIEW_ROW_LIMIT = 6;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function UploadStep({
  snapshot,
  snapshotLoading,
  snapshotError,
  csvData,
  onRefreshBoard,
  onCsvLoaded,
  onContinue,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function processFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.headers.length === 0) {
        setParseError('No column headers were found in this CSV file.');
        return;
      }
      onCsvLoaded(parsed);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Unable to read CSV file.'
      );
    } finally {
      setParsing(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    void processFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    void processFile(file);
  }

  const canContinue = Boolean(
    csvData && csvData.headers.length > 0 && csvData.rows.length > 0 && snapshot
  );

  return (
    <div className="cs-stack-lg">
      <section className="cs-card">
        <div className="cs-row">
          <div style={{ flex: '1 1 320px' }}>
            <h2 className="cs-card-title">Board Snapshot</h2>
            <p className="cs-card-desc">
              Download your board&apos;s cards as a template with real Card IDs, or
              refresh before importing your updated spreadsheet.
            </p>
          </div>
          <div className="cs-actions">
            <button
              type="button"
              className="cs-btn"
              disabled={snapshotLoading}
              onClick={() => void onRefreshBoard()}
            >
              {snapshotLoading ? 'Refreshing...' : 'Refresh Board'}
            </button>
            <button
              type="button"
              className="cs-btn"
              disabled={!snapshot || snapshotLoading}
              onClick={() => snapshot && exportBoardTemplateCsv(snapshot)}
            >
              Download Board CSV Template
            </button>
          </div>
        </div>

        {snapshotError && (
          <div
            className="cs-alert cs-alert-error"
            role="alert"
            style={{ marginTop: 12 }}
          >
            {snapshotError}
          </div>
        )}

        {snapshot ? (
          <div className="cs-stats-grid">
            <div className="cs-stat-tile">
              <div className="cs-label">Open Cards</div>
              <div className="cs-stat-value">{snapshot.cards.length}</div>
            </div>
            <div className="cs-stat-tile">
              <div className="cs-label">Lists</div>
              <div className="cs-stat-value">{snapshot.lists.length}</div>
            </div>
            <div className="cs-stat-tile">
              <div className="cs-label">Labels</div>
              <div className="cs-stat-value">{snapshot.labels.length}</div>
            </div>
            <div className="cs-stat-tile">
              <div className="cs-label">Members</div>
              <div className="cs-stat-value">{snapshot.members.length}</div>
            </div>
          </div>
        ) : (
          snapshotLoading && (
            <p className="cs-card-desc" style={{ marginTop: 12 }}>
              Loading board cards, lists, labels, and members...
            </p>
          )
        )}
      </section>

      <section className="cs-card cs-stack-md">
        <div>
          <h2 className="cs-card-title">Upload CSV File</h2>
          <p className="cs-card-desc">
            Select a spreadsheet containing a Card ID column and the fields you want
            to update.
          </p>
        </div>

        <div
          className={`cs-dropzone ${dragging ? 'cs-dropzone-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="cs-dropzone-icon">
            <UploadIcon />
          </div>
          <div className="cs-dropzone-title">
            {parsing
              ? 'Parsing CSV...'
              : csvData
                ? `${csvData.fileName} (${formatBytes(csvData.fileSize)})`
                : 'Drop your .csv file here, or click to browse'}
          </div>
          <div className="cs-dropzone-sub">
            Supports UTF-8 CSV files with quoted multiline descriptions, due dates,
            labels, and member usernames.
          </div>
        </div>

        {parseError && (
          <div className="cs-alert cs-alert-error" role="alert">
            {parseError}
          </div>
        )}

        {csvData && (
          <div className="cs-stack-md">
            <div className="cs-file-bar">
              <div className="cs-actions">
                <span className="cs-pill cs-pill-success">
                  {csvData.rows.length} rows
                </span>
                <span className="cs-pill cs-pill-info">
                  {csvData.headers.length} columns
                </span>
                <span className="cs-card-desc">{csvData.fileName}</span>
              </div>
              <button
                type="button"
                className="cs-btn cs-btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace CSV
              </button>
            </div>

            {csvData.duplicateHeaders.length > 0 && (
              <div className="cs-alert cs-alert-warning">
                Duplicate column headers detected (auto-renamed):{' '}
                {csvData.duplicateHeaders.join(', ')}
              </div>
            )}

            {csvData.parseWarnings.length > 0 && (
              <div className="cs-alert cs-alert-warning">
                CSV parser warnings: {csvData.parseWarnings.slice(0, 3).join(' | ')}
              </div>
            )}

            {csvData.rows.length === 0 ? (
              <div className="cs-alert cs-alert-error">
                This CSV file has headers but no data rows.
              </div>
            ) : (
              <div>
                <div className="cs-label">
                  Preview (first {Math.min(PREVIEW_ROW_LIMIT, csvData.rows.length)} of{' '}
                  {csvData.rows.length} rows)
                </div>
                <div className="cs-table-wrap">
                  <table className="cs-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        {csvData.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="cs-row-num">{row.rowNumber}</td>
                          {csvData.headers.map((header) => (
                            <td key={header} title={row.values[header]}>
                              {row.values[header] || (
                                <span className="cs-cell-empty">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="cs-row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cs-btn cs-btn-primary"
                disabled={!canContinue}
                onClick={onContinue}
              >
                Continue to Column Mapping &rarr;
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
