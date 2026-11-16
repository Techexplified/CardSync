import '../../styles/auth.css';

interface AuthSectionProps {
  authUrl: string;
  authorizing: boolean;
  onAuthorizeStart: () => void;
  error?: string | null;
}

function TrelloIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect width="24" height="24" rx="4" fill="currentColor" />
      <rect x="3.5" y="3.5" width="7" height="12" rx="1.5" fill="#ffffff" />
      <rect x="13.5" y="3.5" width="7" height="8" rx="1.5" fill="#ffffff" />
    </svg>
  );
}

function ShieldIcon() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ZapIcon() {
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
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function LockIcon() {
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function AuthSection({
  authUrl,
  authorizing,
  onAuthorizeStart,
  error,
}: AuthSectionProps) {
  return (
    <section className="cs-auth-hero" aria-label="Trello Authorization">
      {/* Top Pill Badge */}
      <div className="cs-auth-badge">
        <span className="cs-auth-badge-dot" />
        Trello Account Authorization
      </div>

      {/* Hero Header */}
      <div className="cs-auth-header">
        <h1 className="cs-auth-title">Connect CardSync to Trello</h1>
        <p className="cs-auth-desc">
          Safely match and update existing cards in place from your CSV
          spreadsheets without creating duplicates or altering unmapped fields.
        </p>
      </div>

      {/* Error Notice if any */}
      {error && (
        <div
          className="cs-alert cs-alert-error"
          style={{ width: '100%', maxWidth: 680, textAlign: 'left' }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* 3 Blue-and-White Feature Highlight Cards */}
      <div className="cs-auth-features">
        <div className="cs-auth-feature-card">
          <div className="cs-auth-icon-wrap">
            <ShieldIcon />
          </div>
          <div className="cs-auth-feature-title">100% Client-Side &amp; Private</div>
          <p className="cs-auth-feature-desc">
            All CSV parsing, validation, and diff computing run locally inside
            your browser. Zero external servers store your cards or tokens.
          </p>
        </div>

        <div className="cs-auth-feature-card">
          <div className="cs-auth-icon-wrap">
            <ZapIcon />
          </div>
          <div className="cs-auth-feature-title">In-Place Updates (Zero Duplicates)</div>
          <p className="cs-auth-feature-desc">
            Matches cards by ID, URL, short ID, or Title and modifies fields
            directly via official Trello REST APIs with automatic rate limiting.
          </p>
        </div>

        <div className="cs-auth-feature-card">
          <div className="cs-auth-icon-wrap">
            <LockIcon />
          </div>
          <div className="cs-auth-feature-title">Official Atlassian OAuth</div>
          <p className="cs-auth-feature-desc">
            Uses standard read/write scopes. Tokens are stored securely in your
            private member storage and can be revoked at any time.
          </p>
        </div>
      </div>

      {/* Primary Call to Action */}
      <div className="cs-auth-cta-wrap">
        <a
          href={authUrl}
          target="_blank"
          rel="opener"
          className="cs-auth-btn-connect"
          onClick={onAuthorizeStart}
        >
          <TrelloIcon />
          Connect Trello Account ↗
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

        {/* Permissions & Expiration Meta */}
        <div className="cs-auth-footer-note">
          <span>Scope:</span>
          <span className="cs-auth-footer-pill">read, write</span>
          <span>&middot; Lifetime:</span>
          <span className="cs-auth-footer-pill">30 days</span>
          <span>&middot;</span>
          <span>Instant one-click disconnect</span>
        </div>
      </div>
    </section>
  );
}

