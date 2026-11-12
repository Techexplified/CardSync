import { useEffect, useState, type FormEvent } from 'react';
import { getTrelloInitOptions } from '../config/trello';
import type { CardSyncSettings, TrelloClient } from '../types/trello';

const DEFAULT_SETTINGS: CardSyncSettings = {
  showBadges: true,
  defaultLabel: 'Synced',
};

export function SettingsApp() {
  const [t] = useState<TrelloClient | null>(() =>
    window.TrelloPowerUp
      ? window.TrelloPowerUp.iframe(getTrelloInitOptions())
      : null
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
      <div className="cs-scope cs-panel">
        <div className="cs-subbox">
          Open Settings from the CardSync Power-Up menu inside Trello.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cs-scope cs-panel">
        <div className="cs-subbox">Loading settings...</div>
      </div>
    );
  }

  return (
    <form className="cs-scope cs-panel" onSubmit={(e) => void handleSave(e)}>
      <h2 className="cs-panel-title">CardSync Settings</h2>

      <label className="cs-checkbox">
        <input
          type="checkbox"
          checked={showBadges}
          onChange={(e) => setShowBadges(e.target.checked)}
        />
        Show CardSync badge on synced cards
      </label>

      <div>
        <div className="cs-label">Badge Label</div>
        <input
          className="cs-input"
          type="text"
          value={defaultLabel}
          maxLength={24}
          onChange={(e) => setDefaultLabel(e.target.value)}
          placeholder="Synced"
        />
      </div>

      <div className="cs-actions">
        <button
          type="submit"
          className="cs-btn cs-btn-primary cs-btn-sm"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          type="button"
          className="cs-btn cs-btn-sm"
          onClick={() => void t.closePopup()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
