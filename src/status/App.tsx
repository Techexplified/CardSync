import { useState } from 'react';
import { hasTrelloAppKey } from '../config/trello';

const CAPABILITIES = [
  'board-buttons',
  'card-buttons',
  'card-badges',
  'show-settings',
];

export function StatusApp() {
  const [copied, setCopied] = useState(false);
  const connectorUrl = `${window.location.origin}/`;
  const sdkLoaded = Boolean(window.TrelloPowerUp);
  const isHttps = window.location.protocol === 'https:';
  const appKeyConfigured = hasTrelloAppKey();

  async function copyUrl() {
    await navigator.clipboard.writeText(connectorUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="cs-scope cs-status-page">
      <section className="cs-card cs-status-container cs-stack-md">
        <div className="cs-row">
          <div>
            <h1 className="cs-brand-title" style={{ fontSize: 22 }}>
              CardSync Power-Up
            </h1>
            <p className="cs-card-desc" style={{ marginTop: 4 }}>
              Bulk update existing Trello cards from CSV uploads without creating
              duplicates.
            </p>
          </div>
          <span
            className={`cs-pill ${
              sdkLoaded && isHttps && appKeyConfigured
                ? 'cs-pill-success'
                : 'cs-pill-warning'
            }`}
          >
            {sdkLoaded && isHttps && appKeyConfigured
              ? 'Ready for Trello'
              : 'Setup Needed'}
          </span>
        </div>

        <div>
          <div className="cs-label">Iframe Connector URL</div>
          <div className="cs-code-row">
            <span>{connectorUrl}</span>
            <button
              type="button"
              className="cs-btn cs-btn-sm"
              onClick={() => void copyUrl()}
            >
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>

        <div className="cs-subbox cs-stack-sm">
          <div className="cs-label">Environment Checks</div>
          <div>
            HTTPS enabled: <strong>{isHttps ? 'Yes' : 'No (Trello requires HTTPS)'}</strong>
          </div>
          <div>
            Trello Power-Up Client SDK:{' '}
            <strong>{sdkLoaded ? 'Loaded' : 'Not detected'}</strong>
          </div>
          <div>
            Trello API Key (<code>VITE_TRELLO_APP_KEY</code>):{' '}
            <strong>
              {appKeyConfigured
                ? 'Configured'
                : 'Not set (required for REST API authorization)'}
            </strong>
          </div>
        </div>

        <div>
          <div className="cs-label">Capabilities to Enable in Trello Admin Portal</div>
          <div className="cs-actions" style={{ marginTop: 6 }}>
            {CAPABILITIES.map((cap) => (
              <span key={cap} className="cs-pill cs-pill-muted">
                {cap}
              </span>
            ))}
          </div>
        </div>

        <ol className="cs-step-list">
          <li>
            Open{' '}
            <a
              href="https://trello.com/power-ups/admin"
              target="_blank"
              rel="noreferrer"
            >
              https://trello.com/power-ups/admin
            </a>{' '}
            and click <strong>New</strong> (or select CardSync).
          </li>
          <li>
            Paste <code>{connectorUrl}</code> into <strong>Iframe connector URL</strong>.
          </li>
          <li>
            In <strong>API Key</strong>, generate an API key, add{' '}
            <code>{window.location.origin}</code> to <strong>Allowed Origins</strong>,
            and set <code>VITE_TRELLO_APP_KEY</code> in Vercel Environment Variables.
          </li>
          <li>
            In <strong>Capabilities</strong>, turn on the 4 capabilities listed above.
          </li>
          <li>
            Open any Trello board in your Workspace, click <strong>Power-Ups</strong>{' '}
            &rarr; <strong>Custom</strong> &rarr; enable <strong>CardSync</strong>.
          </li>
        </ol>
      </section>
    </main>
  );
}
