import { useEffect, useState } from 'react';
import { getTrelloInitOptions } from '../config/trello';
import {
  authorizeTrello,
  disconnectTrello,
  getAuthStatus,
  type AuthStatus,
} from '../services/trelloAuth';
import type { TrelloBoard, TrelloClient } from '../types/trello';

const WIZARD_STEPS = [
  '1. CSV Upload',
  '2. Column Mapping',
  '3. Validation',
  '4. Before / After Preview',
  '5. Execution Report',
];

export function ModalApp() {
  const [t] = useState<TrelloClient | null>(() =>
    window.TrelloPowerUp
      ? window.TrelloPowerUp.iframe(getTrelloInitOptions())
      : null
  );
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(() => Boolean(window.TrelloPowerUp));
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [t]);

  async function handleAuthorize() {
    if (!t || authorizing) return;
    setAuthorizing(true);
    setError(null);
    try {
      const result = await authorizeTrello(t);
      setAuth({
        state: 'authorized',
        member: result.member,
        token: result.token,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Trello authorization was canceled or blocked. Verify Allowed Origins in Trello Admin.'
      );
    } finally {
      setAuthorizing(false);
    }
  }

  async function handleDisconnect() {
    if (!t) return;
    await disconnectTrello(t);
    setAuth({ state: 'unauthorized' });
  }

  if (!t) {
    return (
      <main className="modal-shell">
        <div className="modal-card">
          <h1>CardSync — Bulk CSV Updater</h1>
          <p>
            Open this modal from the <strong>CardSync</strong> button on a Trello
            board.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="modal-shell">
      <header className="modal-topbar">
        <div>
          <h1 className="modal-heading">CardSync — Bulk CSV Updater</h1>
          <div className="modal-subtext">
            Board: <strong>{board?.name ?? 'Loading...'}</strong>
          </div>
        </div>

        <div className="actions-row">
          {auth?.state === 'authorized' && (
            <>
              <span className="pill pill-success">
                Connected as @{auth.member.username}
              </span>
              <button type="button" onClick={() => void handleDisconnect()}>
                Disconnect
              </button>
            </>
          )}
          {auth?.state === 'unauthorized' && (
            <span className="pill pill-muted">Authorization required</span>
          )}
          {auth?.state === 'missing-key' && (
            <span className="pill pill-warning">API key not configured</span>
          )}
          <button type="button" onClick={() => void t.closeModal()}>
            Close
          </button>
        </div>
      </header>

      <nav className="wizard-steps" aria-label="Bulk update steps">
        {WIZARD_STEPS.map((step, index) => (
          <div
            key={step}
            className={`wizard-step ${
              auth?.state === 'authorized' && index === 0
                ? 'wizard-step-active'
                : ''
            }`}
          >
            {step}
          </div>
        ))}
      </nav>

      {error && (
        <div className="alert-banner alert-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <section className="modal-card">
          <p>Checking Trello connection and authorization...</p>
        </section>
      )}

      {!loading && auth?.state === 'missing-key' && (
        <section className="modal-card">
          <h2>Configure Your Trello API Key</h2>
          <p>
            Bulk card updates use Trello&apos;s REST API so existing cards are updated
            without creating duplicates. Set <code>VITE_TRELLO_APP_KEY</code> before
            authorizing users.
          </p>
          <ol className="step-list">
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
              <strong>Vercel Project Settings → Environment Variables</strong> (and{' '}
              <code>.env</code> locally), then redeploy.
            </li>
          </ol>
        </section>
      )}

      {!loading && auth?.state === 'unauthorized' && (
        <section className="modal-card">
          <h2>Authorize Trello Access</h2>
          <p>
            Grant CardSync read and write permission on your Trello account so it can
            match existing cards by Card ID and apply validated CSV updates.
          </p>
          <div className="card-box" style={{ marginBottom: 16 }}>
            <div className="muted-label">Requested Permissions</div>
            <div>
              Scope: <code>read,write</code> &middot; Token lifetime:{' '}
              <code>30 days</code>
            </div>
          </div>
          <button
            type="button"
            className="mod-primary"
            disabled={authorizing}
            onClick={() => void handleAuthorize()}
          >
            {authorizing ? 'Opening Trello Authorization...' : 'Connect Trello Account'}
          </button>
        </section>
      )}

      {!loading && auth?.state === 'authorized' && (
        <section className="modal-card">
          <div className="panel-header" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Trello Connection Ready</h2>
            <span className="pill pill-success">Feature A Complete</span>
          </div>
          <p>
            Authenticated as <strong>{auth.member.fullName}</strong> (
            <code>@{auth.member.username}</code>) on board{' '}
            <strong>{board?.name}</strong>.
          </p>
          <div className="card-box">
            <div className="muted-label">Next Step</div>
            <div>
              Ready to wire up <strong>Step 1: CSV Upload &amp; Board Export Template</strong>{' '}
              and the card matching / validation pipeline.
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

