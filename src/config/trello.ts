export const TRELLO_APP_KEY = (import.meta.env.VITE_TRELLO_APP_KEY ?? '').trim();
export const TRELLO_APP_NAME = 'CardSync';

export function hasTrelloAppKey(): boolean {
  return TRELLO_APP_KEY.length > 0;
}

export function getTrelloInitOptions():
  | { appKey: string; appName: string }
  | undefined {
  if (!TRELLO_APP_KEY) {
    return undefined;
  }

  return {
    appKey: TRELLO_APP_KEY,
    appName: TRELLO_APP_NAME,
  };
}

