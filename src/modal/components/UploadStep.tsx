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
    <div className="stack-lg">
      <section className="modal-card">
        <div className="panel-header" style={{ marginBottom: 8 }}>
          <div>
            <h2>Step 1: Board Snapshot &amp; CSV Upload</h2>
            <p style={{ marginBottom: 0 }}>
              Export your current board as a template with real Card IDs, or upload
              an existing spreadsheet to update cards in bulk.
            </p>
          </div>
          <div className="actions-row">
            <button
              type="button"
              disabled={snapshotLoading}
              onClick={() => void onRefreshBoard()}
            >
              {snapshotLoading ? 'Refreshing...' : 'Refresh Board'}
            </button>
            <button
              type="button"
              disabled={!snapshot || snapshotLoading}
              onClick={() => snapshot && exportBoardTemplateCsv(snapshot)}
            >
              Download Board CSV Template
            </button>
          </div>
        </div>

        {snapshotError && (
          <div className="alert-banner alert-error" role="alert">
            {snapshotError}
          </div>
        )}

        {snapshot && (
          <div className="stats-grid">
            <div className="stat-box">
              <div className="muted-label">Open Cards</div>
              <div className="stat-value">{snapshot.cards.length}</div>
            </div>
            <div className="stat-box">
              <div className="muted-label">Lists</div>
              <div className="stat-value">{snapshot.lists.length}</div>
            </div>
            <div className="stat-box">
              <div className="muted-label">Labels</div>
              <div className="stat-value">{snapshot.labels.length}</div>
            </div>
            <div className="stat-box">
              <div className="muted-label">Members</div>
              <div className="stat-value">{snapshot.members.length}</div>
            </div>
          </div>
        )}
      </section>

      <section className="modal-card">
        <div
          className={`dropzone ${dragging ? 'dropzone-active' : ''}`}
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
          <div className="dropzone-title">
            {parsing
              ? 'Parsing CSV...'
              : csvData
                ? `Uploaded: ${csvData.fileName} (${formatBytes(csvData.fileSize)})`
                : 'Drop your .csv file here or click to browse'}
          </div>
          <div className="dropzone-subtitle">
            Must contain a Card ID column to match existing Trello cards without
            duplicates.
          </div>
        </div>

        {parseError && (
          <div
            className="alert-banner alert-error"
            role="alert"
            style={{ marginTop: 12 }}
          >
            {parseError}
          </div>
        )}

        {csvData && (
          <div className="stack-md" style={{ marginTop: 16 }}>
            <div className="panel-header">
              <div className="actions-row">
                <span className="pill pill-success">
                  {csvData.rows.length} rows detected
                </span>
                <span className="pill pill-muted">
                  {csvData.headers.length} columns
                </span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace CSV
              </button>
            </div>

            {csvData.duplicateHeaders.length > 0 && (
              <div className="alert-banner alert-warning">
                Duplicate column headers detected (auto-renamed):{' '}
                {csvData.duplicateHeaders.join(', ')}
              </div>
            )}

            {csvData.parseWarnings.length > 0 && (
              <div className="alert-banner alert-warning">
                CSV parser warnings: {csvData.parseWarnings.slice(0, 3).join(' | ')}
              </div>
            )}

            {csvData.rows.length === 0 ? (
              <div className="alert-banner alert-error">
                This CSV file has headers but no data rows.
              </div>
            ) : (
              <div>
                <div className="muted-label">
                  Preview (first {Math.min(PREVIEW_ROW_LIMIT, csvData.rows.length)} of{' '}
                  {csvData.rows.length} rows)
                </div>
                <div className="table-scroll">
                  <table className="data-table">
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
                          <td className="row-num">{row.rowNumber}</td>
                          {csvData.headers.map((header) => (
                            <td key={header} title={row.values[header]}>
                              {row.values[header] || (
                                <span className="cell-empty">—</span>
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

            <div className="panel-header" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="mod-primary"
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

