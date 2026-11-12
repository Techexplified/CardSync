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

export interface TrelloInitOptions {
  appKey: string;
  appName: string;
}

export interface TrelloAuthorizeOptions {
  scope: 'read' | 'write' | 'read,write';
  expiration?: '1hour' | '1day' | '30days' | 'never';
}

export interface TrelloRestApi {
  isAuthorized: () => Promise<boolean>;
  authorize: (options: TrelloAuthorizeOptions) => Promise<void>;
  getToken: () => Promise<string | null>;
  clearToken: () => Promise<void>;
}

export interface TrelloBoard {
  id: string;
  name: string;
  url?: string;
}

export interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloBoardMember {
  id: string;
  fullName: string;
  username: string;
}

export interface TrelloCard {
  id: string;
  idShort?: number;
  shortLink?: string;
  name: string;
  desc?: string;
  due?: string | null;
  idList?: string;
  idLabels?: string[];
  idMembers?: string[];
  url?: string;
}

export interface BoardSnapshot {
  board: TrelloBoard;
  cards: TrelloCard[];
  lists: TrelloList[];
  labels: TrelloLabel[];
  members: TrelloBoardMember[];
  fetchedAt: string;
}

export interface TrelloMemberProfile {
  id: string;
  fullName: string;
  username: string;
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
  cards: (...fields: string[]) => Promise<TrelloCard[]>;
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
  getRestApi: () => TrelloRestApi;
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
  initialize: (
    handlers: TrelloCapabilityHandlers,
    options?: TrelloInitOptions
  ) => void;
  iframe: (options?: TrelloInitOptions) => TrelloClient;
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
