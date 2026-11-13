import { useCallback, useEffect, useState } from 'react';
import {
  buildTrelloAuthUrl,
  disconnectTrello,
  getAuthStatus,
  saveManualToken,
  type AuthStatus,
} from '../services/trelloAuth';
import { fetchBoardSnapshot } from '../services/trelloBoard';
import type { ParsedCsvData } from '../types/cardsync';
import type { BoardSnapshot, TrelloBoard, TrelloClient } from '../types/trello';
import { UploadStep } from './components/UploadStep';

const WIZARD_STEPS = [
  'CSV Upload',
  'Column Mapping',
  'Validation',
  'Preview',
  'Execution Report',
];

function SyncLogoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

interface ModalAppProps {
  trelloClient: TrelloClient | null;
}

export function ModalApp({ trelloClient }: ModalAppProps) {
  const t = trelloClient;
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(() => Boolean(window.TrelloPowerUp));
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [csvData, setCsvData] = useState<ParsedCsvData | null>(null);

  const [manualToken, setManualToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  const loadBoardData = useCallback(
    async (boardData: TrelloBoard, token: string) => {
      setSnapshotLoading(true);
      setSnapshotError(null);
      try {
        const nextSnapshot = await fetchBoardSnapshot(boardData, token);
        setSnapshot(nextSnapshot);
      } catch (err) {
        setSnapshotError(
          err instanceof Error ? err.message : 'Failed to load Trello board data.'
        );
      } finally {
        setSnapshotLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!t) return;
    let cancelled = false;

    async function load() {
      if (!t) return;
      try {
        const [boardData, authStatus] = await Promise.all([
          t.board('id', 'name'),
          getAuthStatus(t),
        ]);
        if (cancelled) return;
        setBoard(boardData);
        setAuth(authStatus);

        if (authStatus.state === 'authorized') {
          void loadBoardData(boardData, authStatus.token);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to initialize CardSync.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t, loadBoardData]);

  const applyToken = useCallback(
    async (tokenString: string) => {
      if (!t) return;
      try {
        const result = await saveManualToken(t, tokenString);
        setAuth({
          state: 'authorized',
          member: result.member,
          token: result.token,
        });
        setAuthorizing(false);
        setError(null);
        if (board) {
          void loadBoardData(board, result.token);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to authorize with the received token.'
        );
        setAuthorizing(false);
      }
    },
    [t, board, loadBoardData]
  );

  // Auto-listen for token from redirect tab via postMessage, window.authorize, BroadcastChannel, and localStorage
  useEffect(() => {
    if (!t) return;

    // Attach Trello's classic callback on window so window.opener.authorize() works
    (window as unknown as { authorize?: (tok: string) => void }).authorize = (
      tok: string
    ) => {
      void applyToken(tok);
    };

    function handleStorage(event: StorageEvent) {
      if (event.key === 'token' && event.newValue) {
        const token = event.newValue.trim();
        try {
          localStorage.removeItem('token');
        } catch {
          // ignore
        }
        if (token.length > 10) {
          void applyToken(token);
        }
      }
    }

    function handleMessage(event: MessageEvent) {
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'CARDSYNC_AUTH_TOKEN' &&
        typeof event.data.token === 'string'
      ) {
        void applyToken(event.data.token);
      }
    }

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('cardsync_auth_channel');
      bc.onmessage = (event: MessageEvent<{ token?: string }>) => {
        if (event.data?.token) {
          void applyToken(event.data.token);
        }
      };
    } catch {
      // ignore
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
      if (bc) {
        bc.close();
      }
      delete (window as unknown as { authorize?: (tok: string) => void }).authorize;
    };
  }, [t, applyToken]);

  async function handleSaveManualToken() {
    if (!t || savingManual || !manualToken.trim()) return;
    setSavingManual(true);
    setError(null);
    try {
      const result = await saveManualToken(t, manualToken);
      setAuth({
        state: 'authorized',
        member: result.member,
        token: result.token,
      });
      setManualToken('');
      setShowManual(false);
      if (board) {
        void loadBoardData(board, result.token);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invalid Trello token. Please verify and try again.'
      );
    } finally {
      setSavingManual(false);
    }
  }

  async function handleDisconnect() {
    if (!t) return;
    await disconnectTrello(t);
    setAuth({ state: 'unauthorized' });
    setSnapshot(null);
    setCsvData(null);
    setActiveStep(0);
  }

  async function handleRefreshBoard() {
    if (!board || auth?.state !== 'authorized') return;
    await loadBoardData(board, auth.token);
  }

  if (!t) {
    return (
      <main className="cs-scope cs-modal-bg">
        <div className="cs-modal-container">
          <div className="cs-card cs-auth-card cs-stack-sm">
            <h1 className="cs-card-title">CardSync — Bulk CSV Updater</h1>
            <p className="cs-card-desc">
              Open this modal from the <strong>CardSync</strong> button on a Trello
              board.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cs-scope cs-modal-bg">
      <div className="cs-modal-container">
        <header className="cs-topbar">
          <div className="cs-brand">
            <div className="cs-brand-icon">
              <SyncLogoIcon />
            </div>
            <div>
              <h1 className="cs-brand-title">CardSync</h1>
              <div className="cs-brand-sub">
                Bulk CSV Updater &middot; Board:{' '}
                <strong>{board?.name ?? 'Loading...'}</strong>
              </div>
            </div>
          </div>

          <div className="cs-actions">
            {auth?.state === 'authorized' && (
              <>
                <span className="cs-pill cs-pill-success">
                  <span className="cs-dot" />@{auth.member.username}
                </span>
                <button
                  type="button"
                  className="cs-btn cs-btn-subtle cs-btn-sm"
                  onClick={() => void handleDisconnect()}
                >
                  Disconnect
                </button>
              </>
            )}
            {auth?.state === 'unauthorized' && (
              <span className="cs-pill cs-pill-muted">
                Authorization required
              </span>
            )}
            {auth?.state === 'missing-key' && (
              <span className="cs-pill cs-pill-warning">
                API key not configured
              </span>
            )}
            <button
              type="button"
              className="cs-btn cs-btn-sm"
              onClick={() => void t.closeModal()}
            >
              Close
            </button>
          </div>
        </header>

        <nav className="cs-stepper" aria-label="Bulk update steps">
          {WIZARD_STEPS.map((label, index) => {
            const isActive = auth?.state === 'authorized' && index === activeStep;
            const isDone = auth?.state === 'authorized' && index < activeStep;
            return (
              <div
                key={label}
                className={`cs-step ${
                  isActive ? 'cs-step-active' : isDone ? 'cs-step-done' : ''
                }`}
              >
                <span className="cs-step-num">{isDone ? '✓' : index + 1}</span>
                <span className="cs-step-label">{label}</span>
              </div>
            );
          })}
        </nav>

        {error && (
          <div className="cs-alert cs-alert-error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <section className="cs-card cs-auth-card">
            <p className="cs-card-desc">
              Checking Trello connection and authorization...
            </p>
          </section>
        )}

        {!loading && auth?.state === 'missing-key' && (
          <section className="cs-card cs-auth-card cs-stack-md">
            <div>
              <h2 className="cs-card-title">Configure Your Trello API Key</h2>
              <p className="cs-card-desc">
                Bulk card updates use Trello&apos;s REST API so existing cards are
                updated without creating duplicates. Set{' '}
                <code>VITE_TRELLO_APP_KEY</code> before authorizing users.
              </p>
            </div>
            <ol className="cs-step-list">
              <li>
                Open{' '}
                <a
                  href="https://trello.com/power-ups/admin"
                  target="_blank"
                  rel="noreferrer"
                >
                  Trello Power-Up Admin
                </a>{' '}
                → select <strong>CardSync</strong> → <strong>API Key</strong>.
              </li>
              <li>
                Add <code>{window.location.origin}</code> under{' '}
                <strong>Allowed Origins</strong>.
              </li>
              <li>
                Copy your API Key into <code>VITE_TRELLO_APP_KEY</code> in{' '}
                <strong>Vercel Project Settings → Environment Variables</strong> (with
                Config visibility), then redeploy.
              </li>
            </ol>
          </section>
        )}

        {!loading && auth?.state === 'unauthorized' && (
          <section className="cs-card cs-auth-card cs-stack-md">
            <div>
              <h2 className="cs-card-title">Authorize Trello Access</h2>
              <p className="cs-card-desc">
                Grant CardSync read and write permission on your Trello account so it
                can match existing cards by Card ID and apply validated CSV updates.
              </p>
            </div>
            <div className="cs-subbox">
              <div className="cs-label">Requested Permissions</div>
              <div>
                Scope: <code>read,write</code> &middot; Token lifetime:{' '}
                <code>30 days</code>
              </div>
            </div>
            <div className="cs-actions">
              <a
                href={buildTrelloAuthUrl()}
                target="_blank"
                rel="opener"
                className="cs-btn cs-btn-primary"
                onClick={() => {
                  setAuthorizing(true);
                  setError(null);
                }}
              >
                Connect Trello Account ↗
              </a>
              <button
                type="button"
                className="cs-btn cs-btn-subtle"
                onClick={() => setShowManual((prev) => !prev)}
              >
                {showManual ? 'Hide Manual Token' : 'Paste Token / URL Manually'}
              </button>
            </div>

            {authorizing && (
              <div className="cs-alert" style={{ background: '#e9f2ff', color: '#0052cc', border: '1px solid #b3d4ff' }}>
                Opened Trello authorization in a new tab. Click <strong>Allow</strong> on Trello! CardSync will connect automatically once approved.
              </div>
            )}

            {showManual && (
              <div className="cs-subbox cs-stack-sm" style={{ marginTop: 8 }}>
                <div className="cs-label">Paste Token or Callback URL</div>
                <p className="cs-card-desc" style={{ marginBottom: 6 }}>
                  If the tab does not close automatically, copy the token or the full URL from the address bar (e.g. <code>https://...#token=...</code>) and paste it below:
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    className="cs-input"
                    placeholder="Paste token or redirected URL (e.g. https://...#token=...)"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cs-btn cs-btn-primary cs-btn-sm"
                    disabled={savingManual || !manualToken.trim()}
                    onClick={() => void handleSaveManualToken()}
                  >
                    {savingManual ? 'Saving...' : 'Save Token'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && auth?.state === 'authorized' && activeStep === 0 && (
          <UploadStep
            snapshot={snapshot}
            snapshotLoading={snapshotLoading}
            snapshotError={snapshotError}
            csvData={csvData}
            onRefreshBoard={handleRefreshBoard}
            onCsvLoaded={(data) => setCsvData(data)}
            onContinue={() => setActiveStep(1)}
          />
        )}

        {!loading && auth?.state === 'authorized' && activeStep === 1 && csvData && (
          <section className="cs-card cs-stack-md">
            <div className="cs-row">
              <div>
                <h2 className="cs-card-title">Step 2: Column Mapping</h2>
                <p className="cs-card-desc">
                  CSV loaded: <strong>{csvData.fileName}</strong> (
                  {csvData.rows.length} rows, {csvData.headers.length} columns). Ready
                  for <strong>Feature C (Column Mapping)</strong>.
                </p>
              </div>
              <button
                type="button"
                className="cs-btn"
                onClick={() => setActiveStep(0)}
              >
                &larr; Back to CSV Upload
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
