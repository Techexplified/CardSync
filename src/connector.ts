import type {
  CardSyncCardState,
  CardSyncSettings,
  TrelloClient,
} from './types/trello';

const DEFAULT_SETTINGS: CardSyncSettings = {
  showBadges: true,
  defaultLabel: 'Synced',
};

const assetUrl = (path: string) => new URL(path, window.location.href).href;

if (window.TrelloPowerUp) {
  window.TrelloPowerUp.initialize({
    'board-buttons': () => [
      {
        icon: {
          dark: assetUrl('/icons/icon-dark.svg'),
          light: assetUrl('/icons/icon-light.svg'),
        },
        text: 'CardSync',
        condition: 'always',
        callback: (t: TrelloClient) =>
          t.popup({
            title: 'CardSync Board',
            url: assetUrl('/popup.html?view=board'),
            height: 240,
          }),
      },
    ],

    'card-buttons': () => [
      {
        icon: assetUrl('/icons/icon-dark.svg'),
        text: 'CardSync',
        condition: 'edit',
        callback: (t: TrelloClient) =>
          t.popup({
            title: 'CardSync',
            url: assetUrl('/popup.html?view=card'),
            height: 260,
          }),
      },
    ],

    'card-badges': async (t: TrelloClient) => {
      const [settings, cardState] = await Promise.all([
        t.get<CardSyncSettings>('board', 'shared', 'settings', DEFAULT_SETTINGS),
        t.get<CardSyncCardState | null>('card', 'shared', 'syncState', null),
      ]);

      if (!settings?.showBadges || !cardState?.synced) {
        return [];
      }

      return [
        {
          icon: assetUrl('/icons/icon-light.svg'),
          text: settings.defaultLabel || 'Synced',
          color: 'green',
        },
      ];
    },

    'show-settings': (t: TrelloClient) =>
      t.popup({
        title: 'CardSync Settings',
        url: assetUrl('/settings.html'),
        height: 220,
      }),
  });
} else {
  console.warn(
    '[CardSync] TrelloPowerUp global was not found. Check https://p.trellocdn.com/power-up.min.js.'
  );
}

// When opened directly in a browser tab (not inside Trello's hidden iframe),
// render a diagnostic & Trello setup page so developers can verify HTTPS and copy the connector URL.
if (window.self === window.top) {
  void import('./status/main');
}

