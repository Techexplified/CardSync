import { useEffect, useState, type FormEvent } from 'react';
import type { CardSyncSettings, TrelloClient } from '../types/trello';

const DEFAULT_SETTINGS: CardSyncSettings = {
  showBadges: true,
  defaultLabel: 'Synced',
};

export function SettingsApp() {
  const [t] = useState<TrelloClient | null>(() =>
    window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null
  );
  const [showBadges, setShowBadges] = useState(true);
  const [defaultLabel, setDefaultLabel] = useState('Synced');
  const [loading, setLoading] = useState(() => Boolean(window.TrelloPowerUp));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!t) {
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      if (!t) return;
      try {
        const stored = await t.get<CardSyncSettings>(
          'board',
          'shared',
          'settings',
          DEFAULT_SETTINGS
        );
        if (cancelled) return;
        setShowBadges(stored?.showBadges ?? DEFAULT_SETTINGS.showBadges);
        setDefaultLabel(stored?.defaultLabel ?? DEFAULT_SETTINGS.defaultLabel);
      } finally {
        if (!cancelled) {
          setLoading(false);
          void t.sizeTo('#root');
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!t || saving) return;
    setSaving(true);
    try {
      const next: CardSyncSettings = {
        showBadges,
        defaultLabel: defaultLabel.trim() || 'Synced',
      };
      await t.set('board', 'shared', 'settings', next);
      await t.closePopup();
    } finally {
      setSaving(false);
    }
  }

  if (!t) {
    return (
      <div className="panel">
        <div className="card-box">
          Open Settings from the CardSync Power-Up menu inside Trello.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="card-box">Loading settings...</div>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={(e) => void handleSave(e)}>
      <h2 className="panel-title">CardSync Settings</h2>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={showBadges}
          onChange={(e) => setShowBadges(e.target.checked)}
        />
        Show CardSync badge on synced cards
      </label>

      <div>
        <div className="muted-label">Badge Label</div>
        <input
          className="input-field"
          type="text"
          value={defaultLabel}
          maxLength={24}
          onChange={(e) => setDefaultLabel(e.target.value)}
          placeholder="Synced"
        />
      </div>

      <div className="actions-row">
        <button type="submit" className="mod-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button type="button" onClick={() => void t.closePopup()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

