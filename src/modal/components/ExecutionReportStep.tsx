import { useEffect, useMemo, useRef, useState } from 'react';
import {
  exportExecutionReportCsv,
  runBatchExecution,
} from '../../core/executor';
import type {
  CardDiff,
  ExecutionCardResult,
  ExecutionLogEntry,
  ExecutionReport,
} from '../../types/cardsync';
import '../../styles/execution.css';

interface ExecutionReportStepProps {
  selectedCards: CardDiff[];
  token: string;
  boardName?: string;
  onBack: () => void;
  onReset: () => void;
  onRefreshBoard?: () => Promise<void>;
}

type ExecutionPhase = 'idle' | 'running' | 'completed' | 'cancelled';
type FilterTab = 'all' | 'success' | 'failed' | 'skipped';

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function ExecutionReportStep({
  selectedCards,
  token,
  boardName = 'Trello Board',
  onBack,
  onReset,
  onRefreshBoard,
}: ExecutionReportStepProps) {
  const [phase, setPhase] = useState<ExecutionPhase>('idle');
  const [progress, setProgress] = useState({
    total: selectedCards.length,
    completed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  });
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [results, setResults] = useState<ExecutionCardResult[]>([]);
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  const abortControllerRef = useRef<AbortController | null>(null);
  const logTerminalRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the log console to bottom when new logs arrive
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Total field updates count
  const totalFieldUpdates = useMemo(
    () =>
      selectedCards.reduce(
        (sum, card) => sum + Object.keys(card.updatePayload).length,
        0
      ),
    [selectedCards]
  );

  async function handleStartExecution() {
    if (phase === 'running') return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPhase('running');
    setLogs([]);
    setResults([]);
    setReport(null);
    setProgress({
      total: selectedCards.length,
      completed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
    });

    try {
      const execReport = await runBatchExecution(selectedCards, {
        token,
        concurrency: 3,
        signal: controller.signal,
        onLog: (entry) => {
          setLogs((prev) => [...prev, entry]);
        },
        onProgress: (p) => {
          setProgress(p);
        },
        onCardComplete: (res) => {
          setResults((prev) => [...prev, res]);
        },
      });

      setReport(execReport);
      setResults(execReport.results);
      setPhase(controller.signal.aborted ? 'cancelled' : 'completed');

      // Silently refresh the board snapshot in background so Trello state is fresh
      if (onRefreshBoard) {
        void onRefreshBoard();
      }
    } catch (err) {
      setPhase('completed');
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Unexpected execution error occurred',
        },
      ]);
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleCancelExecution() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setPhase('cancelled');
    }
  }

  function handleDownloadReport() {
    if (!report) return;
    exportExecutionReportCsv(report, boardName);
  }

  const percent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  const filteredResults = useMemo(() => {
    switch (filter) {
      case 'success':
        return results.filter((r) => r.status === 'success');
      case 'failed':
        return results.filter((r) => r.status === 'failed');
      case 'skipped':
        return results.filter((r) => r.status === 'skipped');
      case 'all':
      default:
        return results;
    }
  }, [results, filter]);

  return (
    <section className="cs-card cs-stack-md">
      {/* Top Header */}
      <div className="cs-row">
        <div>
          <h2 className="cs-card-title">Step 5: Execution &amp; Report</h2>
          <p className="cs-card-desc">
            {phase === 'idle' &&
              `Ready to update ${selectedCards.length} cards (${totalFieldUpdates} field modifications) on "${boardName}".`}
            {phase === 'running' &&
              `Updating cards via Trello REST API... (${progress.completed} of ${progress.total})`}
            {phase === 'completed' &&
              `Execution completed in ${report ? (report.durationMs / 1000).toFixed(1) : 0}s.`}
            {phase === 'cancelled' &&
              `Execution cancelled. ${progress.completed} of ${progress.total} cards were processed.`}
          </p>
        </div>

        <div className="cs-actions">
          {phase === 'idle' && (
            <>
              <button type="button" className="cs-btn" onClick={onBack}>
                &larr; Back to Preview
              </button>
              <button
                type="button"
                className="cs-btn cs-btn-primary"
                onClick={() => void handleStartExecution()}
                disabled={selectedCards.length === 0}
              >
                <RocketIcon />
                Start Update ({selectedCards.length} Cards)
              </button>
            </>
          )}

          {phase === 'running' && (
            <button
              type="button"
              className="cs-btn cs-btn-subtle"
              style={{ color: 'var(--cs-danger)', borderColor: 'var(--cs-danger-border)' }}
              onClick={handleCancelExecution}
            >
              Cancel Sync
            </button>
          )}

          {(phase === 'completed' || phase === 'cancelled') && (
            <>
              <button
                type="button"
                className="cs-btn cs-btn-primary"
                onClick={handleDownloadReport}
                disabled={!report || results.length === 0}
              >
                <DownloadIcon />
                Download Report (CSV)
              </button>
              <button
                type="button"
                className="cs-btn cs-btn-subtle"
                onClick={onReset}
                title="Start a new CSV update session"
              >
                <RefreshIcon />
                Start New Sync
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress & Stat Counters */}
      {(phase === 'running' || phase === 'completed' || phase === 'cancelled') && (
        <div className="cs-progress-wrap">
          <div className="cs-progress-header">
            <div>
              {phase === 'running' && (
                <span>
                  Processing cards... ({progress.completed} / {progress.total})
                </span>
              )}
              {phase === 'completed' && (
                <span style={{ color: 'var(--cs-success)' }}>
                  ✓ Sync Finished ({progress.success} succeeded, {progress.failed} failed)
                </span>
              )}
              {phase === 'cancelled' && (
                <span style={{ color: 'var(--cs-warning)' }}>
                  ⚠ Sync stopped by user ({progress.completed} / {progress.total})
                </span>
              )}
            </div>
            <div>{percent}%</div>
          </div>

          <div className="cs-progress-bar">
            <div
              className={`cs-progress-fill ${
                phase === 'completed' && progress.failed === 0
                  ? 'cs-progress-fill-done'
                  : progress.failed > 0
                  ? 'cs-progress-fill-failed'
                  : ''
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="cs-stats-grid">
        <div className="cs-stat-tile">
          <div className="cs-label">Total Cards</div>
          <div className="cs-stat-value">{progress.total}</div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Updated</div>
          <div className="cs-stat-value" style={{ color: 'var(--cs-success)' }}>
            {progress.success}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Failed</div>
          <div
            className="cs-stat-value"
            style={{ color: progress.failed > 0 ? 'var(--cs-danger)' : 'var(--cs-text)' }}
          >
            {progress.failed}
          </div>
        </div>

        <div className="cs-stat-tile">
          <div className="cs-label">Skipped (No-Op)</div>
          <div className="cs-stat-value" style={{ color: 'var(--cs-text-muted)' }}>
            {progress.skipped}
          </div>
        </div>
      </div>

      {/* Idle Launch Hero */}
      {phase === 'idle' && (
        <div className="cs-exec-hero">
          <div className="cs-exec-hero-icon">
            <RocketIcon />
          </div>
          <div className="cs-exec-hero-title">Ready to execute card updates</div>
          <div className="cs-exec-hero-desc">
            CardSync will update {selectedCards.length} cards on <strong>{boardName}</strong>.
            Updates run safely within Trello rate limits with automatic exponential backoff.
          </div>
          <button
            type="button"
            className="cs-btn cs-btn-primary"
            style={{ minHeight: 40, padding: '0 20px', fontSize: 14 }}
            onClick={() => void handleStartExecution()}
          >
            <RocketIcon />
            Execute Sync Now
          </button>
        </div>
      )}

      {/* Live Log Console */}
      {logs.length > 0 && (
        <div className="cs-terminal-card">
          <div className="cs-terminal-header">
            <span>Live Execution Logs ({logs.length})</span>
            {phase === 'running' && (
              <span className="cs-pill cs-pill-info" style={{ fontSize: 11 }}>
                <span className="cs-dot" /> Live
              </span>
            )}
          </div>
          <div ref={logTerminalRef} className="cs-terminal-body">
            {logs.map((log) => (
              <div key={log.id} className="cs-log-line">
                <span className="cs-log-time">[{log.timestamp}]</span>
                <span className={`cs-log-badge cs-log-badge-${log.level}`}>
                  {log.level}
                </span>
                {log.cardName && (
                  <span className="cs-log-card-name">[{log.cardName}]:</span>
                )}
                <span className="cs-log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Table (After or during execution) */}
      {results.length > 0 && (
        <div className="cs-stack-sm">
          <div className="cs-row" style={{ alignItems: 'center' }}>
            <div className="cs-filter-tabs">
              <button
                type="button"
                className={`cs-filter-btn ${filter === 'all' ? 'cs-filter-btn-active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All Cards <span className="cs-filter-count">{results.length}</span>
              </button>
              <button
                type="button"
                className={`cs-filter-btn ${filter === 'success' ? 'cs-filter-btn-active' : ''}`}
                onClick={() => setFilter('success')}
              >
                Succeeded <span className="cs-filter-count">{progress.success}</span>
              </button>
              {progress.failed > 0 && (
                <button
                  type="button"
                  className={`cs-filter-btn ${filter === 'failed' ? 'cs-filter-btn-active' : ''}`}
                  onClick={() => setFilter('failed')}
                >
                  Failed <span className="cs-filter-count">{progress.failed}</span>
                </button>
              )}
              {progress.skipped > 0 && (
                <button
                  type="button"
                  className={`cs-filter-btn ${filter === 'skipped' ? 'cs-filter-btn-active' : ''}`}
                  onClick={() => setFilter('skipped')}
                >
                  Skipped <span className="cs-filter-count">{progress.skipped}</span>
                </button>
              )}
            </div>

            {report && (
              <button
                type="button"
                className="cs-btn cs-btn-subtle cs-btn-sm"
                onClick={handleDownloadReport}
              >
                <DownloadIcon />
                Download Report (.csv)
              </button>
            )}
          </div>

          <div className="cs-results-table-wrap">
            <table className="cs-results-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Row</th>
                  <th>Card Name</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th>Fields Updated</th>
                  <th>Details / Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => (
                  <tr key={r.cardId}>
                    <td style={{ color: 'var(--cs-text-muted)', fontWeight: 600 }}>
                      {r.rowNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {r.cardName}
                        {r.cardShortId && (
                          <span
                            className="cs-pill cs-pill-muted"
                            style={{ fontSize: 11, marginLeft: 6 }}
                          >
                            #{r.cardShortId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`cs-status-chip cs-status-chip-${r.status}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.updatedFields.length > 0 ? (
                        <span>{r.updatedFields.join(', ')}</span>
                      ) : (
                        <span style={{ color: 'var(--cs-text-muted)', fontStyle: 'italic' }}>
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      {r.error ? (
                        <span style={{ color: 'var(--cs-danger)', fontSize: 12 }}>
                          {r.error}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--cs-success)', fontSize: 12 }}>
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

