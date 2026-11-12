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
    <main className="status-page">
      <section className="status-container">
        <div className="panel-header" style={{ marginBottom: 12 }}>
          <h1>CardSync Power-Up</h1>
          <span
            className={`pill ${
              sdkLoaded && isHttps && appKeyConfigured
                ? 'pill-success'
                : 'pill-warning'
            }`}
          >
            {sdkLoaded && isHttps && appKeyConfigured
              ? 'Ready for Trello'
              : 'Setup Needed'}
          </span>
        </div>

        <p>
          CardSync updates existing Trello cards in bulk from CSV uploads without
          creating duplicates.
        </p>

        <div className="muted-label">Iframe Connector URL</div>
        <div className="code-row">
          <span>{connectorUrl}</span>
          <button type="button" onClick={() => void copyUrl()}>
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
        </div>

        <div className="card-box" style={{ marginTop: 16 }}>
          <div className="muted-label">Environment Checks</div>
          <div>HTTPS enabled: {isHttps ? 'Yes' : 'No (Trello requires HTTPS)'}</div>
          <div>
            Trello Power-Up Client SDK: {sdkLoaded ? 'Loaded' : 'Not detected'}
          </div>
          <div>
            Trello API Key (<code>VITE_TRELLO_APP_KEY</code>):{' '}
            {appKeyConfigured
              ? 'Configured'
              : 'Not set (required for REST API authorization)'}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="muted-label">Capabilities to Enable in Trello Admin Portal</div>
          <div className="badge-list">
            {CAPABILITIES.map((cap) => (
              <span key={cap} className="pill pill-muted">
                {cap}
              </span>
            ))}
          </div>
        </div>

        <ol className="step-list">
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
