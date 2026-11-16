import '../../styles/auth.css';

interface AuthSectionProps {
  authUrl: string;
  authorizing: boolean;
  onAuthorizeStart: () => void;
  error?: string | null;
  onClose?: () => void;
}

function CardSyncIcon() {
  return (
    <svg
      width="26"
      height="26"
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

function TrelloTileIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3.5" y="3.5" width="7" height="13" rx="1.8" fill="#ffffff" />
      <rect x="13.5" y="3.5" width="7" height="8.5" rx="1.8" fill="#ffffff" />
    </svg>
  );
}

function TrelloBtnIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="4.5" fill="#ffffff" />
      <rect x="4" y="4" width="6.5" height="11" rx="1.5" fill="#0c66e4" />
      <rect x="13.5" y="4" width="6.5" height="7.5" rx="1.5" fill="#0c66e4" />
    </svg>
  );
}

function LinkBridgeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function AuthSection({
  authUrl,
  authorizing,
  onAuthorizeStart,
  error,
  onClose,
}: AuthSectionProps) {
  return (
    <section className="cs-auth-hero" aria-label="Trello Authorization">
      {onClose && (
        <button
          type="button"
          className="cs-auth-close-btn"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      )}

      {/* Visual App Logo Bridge */}
      <div className="cs-auth-logos">
        <div className="cs-auth-logo-tile cs-auth-logo-tile-cardsync" title="CardSync">
          <CardSyncIcon />
        </div>
        <div className="cs-auth-logo-bridge">
          <LinkBridgeIcon />
        </div>
        <div className="cs-auth-logo-tile cs-auth-logo-tile-trello" title="Trello">
          <TrelloTileIcon />
        </div>
      </div>

      {/* Top Pill Badge */}
      <div className="cs-auth-badge">
        <span className="cs-auth-badge-dot" />
        Trello Account Authorization
      </div>

      {/* Hero Header */}
      <div className="cs-auth-header">
        <h1 className="cs-auth-title">Connect CardSync to Trello</h1>
        <p className="cs-auth-desc">
          Authorize CardSync to match and update existing cards in place from
          your CSV spreadsheets without creating duplicate cards.
        </p>
      </div>

      {/* Error Notice if any */}
      {error && (
        <div
          className="cs-alert cs-alert-error"
          style={{ width: '100%', maxWidth: 540, textAlign: 'left' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Primary Call to Action */}
      <div className="cs-auth-cta-wrap">
        <a
          href={authUrl}
          target="_blank"
          rel="opener"
          className="cs-auth-btn-connect"
          onClick={onAuthorizeStart}
        >
          <TrelloBtnIcon />
          <span>Connect to Trello ↗</span>
        </a>

        {/* Live waiting banner when authorization tab is open */}
        {authorizing && (
          <div className="cs-auth-banner-waiting">
            <div className="cs-auth-spinner" />
            <div>
              Waiting for authorization... A new tab has opened. Click{' '}
              <strong>Allow</strong> on Trello, and CardSync will automatically
              connect!
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
