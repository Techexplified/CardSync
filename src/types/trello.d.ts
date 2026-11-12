export type TrelloColor =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'purple'
  | 'pink'
  | 'sky'
  | 'lime'
  | 'light-gray';

export type TrelloScope = 'board' | 'card' | 'member' | 'organization';
export type TrelloVisibility = 'shared' | 'private';

export interface TrelloBoard {
  id: string;
  name: string;
  url?: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList?: string;
  url?: string;
}

export interface TrelloPopupOptions {
  title: string;
  url: string;
  height?: number;
  args?: Record<string, unknown>;
}

export interface TrelloModalOptions {
  title?: string;
  url: string;
  height?: number;
  fullscreen?: boolean;
  args?: Record<string, unknown>;
}

export interface TrelloBoardButton {
  icon: {
    dark: string;
    light: string;
  };
  text: string;
  condition?: 'edit' | 'readOnly' | 'always' | 'admin';
  callback?: (t: TrelloClient) => Promise<void> | void;
  url?: string;
}

export interface TrelloCardButton {
  icon: string;
  text: string;
  condition?: 'edit' | 'readOnly' | 'always' | 'admin';
  callback?: (t: TrelloClient) => Promise<void> | void;
  url?: string;
}

export interface TrelloCardBadge {
  text?: string;
  icon?: string;
  color?: TrelloColor | null;
  refresh?: number;
}

export interface TrelloClient {
  board: (...fields: string[]) => Promise<TrelloBoard>;
  card: (...fields: string[]) => Promise<TrelloCard>;
  get: <T = unknown>(
    scope: TrelloScope,
    visibility: TrelloVisibility,
    key: string,
    defaultValue?: T
  ) => Promise<T>;
  set: (
    scope: TrelloScope,
    visibility: TrelloVisibility,
    key: string,
    value: unknown
  ) => Promise<void>;
  remove: (
    scope: TrelloScope,
    visibility: TrelloVisibility,
    key: string
  ) => Promise<void>;
  popup: (options: TrelloPopupOptions) => Promise<void>;
  modal: (options: TrelloModalOptions) => Promise<void>;
  closePopup: () => Promise<void>;
  closeModal: () => Promise<void>;
  sizeTo: (selector: string | HTMLElement) => Promise<void>;
  arg: <T = unknown>(name: string, defaultValue?: T) => T;
  signUrl: (url: string) => string;
}

export interface TrelloCapabilityHandlers {
  'board-buttons'?: (
    t: TrelloClient,
    options: unknown
  ) => TrelloBoardButton[] | Promise<TrelloBoardButton[]>;
  'card-buttons'?: (
    t: TrelloClient,
    options: unknown
  ) => TrelloCardButton[] | Promise<TrelloCardButton[]>;
  'card-badges'?: (
    t: TrelloClient,
    options: unknown
  ) => TrelloCardBadge[] | Promise<TrelloCardBadge[]>;
  'show-settings'?: (t: TrelloClient, options: unknown) => Promise<void> | void;
}

export interface TrelloPowerUpGlobal {
  initialize: (handlers: TrelloCapabilityHandlers) => void;
  iframe: () => TrelloClient;
}

export interface CardSyncSettings {
  showBadges: boolean;
  defaultLabel: string;
}

export interface CardSyncCardState {
  synced: boolean;
  updatedAt: string;
}

declare global {
  interface Window {
    TrelloPowerUp?: TrelloPowerUpGlobal;
  }
}

