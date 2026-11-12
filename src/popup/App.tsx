import { useEffect, useMemo, useState } from 'react';
import { getTrelloInitOptions } from '../config/trello';
import type {
  CardSyncCardState,
  CardSyncSettings,
  TrelloBoard,
  TrelloCard,
  TrelloClient,
} from '../types/trello';

const DEFAULT_SETTINGS: CardSyncSettings = {
  showBadges: true,
  defaultLabel: 'Synced',
};

export function PopupApp() {
  const view = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'board' ? 'board' : 'card';
  }, []);

  const [t] = useState<TrelloClient | null>(() =>
    window.TrelloPowerUp
      ? window.TrelloPowerUp.iframe(getTrelloInitOptions())
      : null
  );
  const [board, setBoard] = useState<TrelloBoard | null>(null);
  const [card, setCard] = useState<TrelloCard | null>(null);
  const [cardState, setCardState] = useState<CardSyncCardState | null>(null);
  const [settings, setSettings] = useState<CardSyncSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(() => Boolean(window.TrelloPowerUp));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!t) {
      return;
    }

    let cancelled = false;

    async function load() {
      if (!t) return;
      try {
        const [boardData, boardSettings] = await Promise.all([
          t.board('id', 'name'),
          t.get<CardSyncSettings>('board', 'shared', 'settings', DEFAULT_SETTINGS),
        ]);

        if (cancelled) return;
        setBoard(boardData);
        setSettings(boardSettings ?? DEFAULT_SETTINGS);

        if (view === 'card') {
          const [cardData, state] = await Promise.all([
            t.card('id', 'name', 'idList'),
            t.get<CardSyncCardState | null>('card', 'shared', 'syncState', null),
          ]);
          if (cancelled) return;
          setCard(cardData);
          setCardState(state);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          void t.sizeTo('#root');
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t, view]);

  useEffect(() => {
    if (t && !loading) {
      void t.sizeTo('#root');
    }
  }, [t, loading, cardState]);

  async function toggleCardSync() {
    if (!t || saving) return;
    setSaving(true);
    try {
      const nextState: CardSyncCardState = {
        synced: !cardState?.synced,
        updatedAt: new Date().toISOString(),
      };
      await t.set('card', 'shared', 'syncState', nextState);
      setCardState(nextState);
    } finally {
      setSaving(false);
    }
  }

  async function openSettings() {
    if (!t) return;
    await t.popup({
      title: 'CardSync Settings',
      url: new URL('/settings.html', window.location.href).href,
      height: 220,
    });
  }

  if (!t) {
    return (
      <div className="cs-scope cs-panel">
        <p className="cs-panel-title">CardSync Popup</p>
        <div className="cs-subbox">
          Open this view from inside a Trello board or card to connect to the Trello
          Power-Up client.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cs-scope cs-panel">
        <div className="cs-subbox">Loading Trello context...</div>
      </div>
    );
  }

  return (
    <div className="cs-scope cs-panel">
      <div className="cs-row">
        <h2 className="cs-panel-title">
          {view === 'board' ? 'Board Connection' : 'Card Sync Status'}
        </h2>
        <span className="cs-pill cs-pill-success">Connected</span>
      </div>

      <div className="cs-subbox">
        <div className="cs-label">Board</div>
        <div>{board?.name ?? 'Unknown board'}</div>
      </div>

      {view === 'card' && card && (
        <div className="cs-subbox cs-stack-sm">
          <div>
            <div className="cs-label">Card</div>
            <div>{card.name}</div>
          </div>
          <div className="cs-row">
            <span
              className={`cs-pill ${
                cardState?.synced ? 'cs-pill-success' : 'cs-pill-muted'
              }`}
            >
              {cardState?.synced ? settings.defaultLabel || 'Synced' : 'Not synced'}
            </span>
            <button
              type="button"
              className="cs-btn cs-btn-primary cs-btn-sm"
              disabled={saving}
              onClick={() => void toggleCardSync()}
            >
              {saving
                ? 'Saving...'
                : cardState?.synced
                  ? 'Clear Sync'
                  : 'Mark Synced'}
            </button>
          </div>
        </div>
      )}

      {view === 'board' && (
        <div className="cs-subbox cs-stack-sm">
          <div>
            <div className="cs-label">Card Badges</div>
            <div>
              Badges are currently{' '}
              <strong>{settings.showBadges ? 'enabled' : 'disabled'}</strong>{' '}
              (label: <code>{settings.defaultLabel}</code>).
            </div>
          </div>
          <div className="cs-actions">
            <button
              type="button"
              className="cs-btn cs-btn-sm"
              onClick={() => void openSettings()}
            >
              Open Settings
            </button>
            <button
              type="button"
              className="cs-btn cs-btn-subtle cs-btn-sm"
              onClick={() => void t.closePopup()}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
