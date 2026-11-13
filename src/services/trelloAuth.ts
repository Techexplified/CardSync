import { hasTrelloAppKey, TRELLO_APP_KEY, TRELLO_APP_NAME } from '../config/trello';
import type { TrelloClient, TrelloMemberProfile } from '../types/trello';

export type AuthStatus =
  | { state: 'missing-key' }
  | { state: 'unauthorized' }
  | { state: 'authorized'; member: TrelloMemberProfile; token: string };

export function buildTrelloAuthUrl(returnUrl?: string): string {
  const targetReturnUrl = returnUrl || `${window.location.origin}/auth.html`;
  const params = new URLSearchParams({
    name: TRELLO_APP_NAME,
    key: TRELLO_APP_KEY,
    expiration: '30days',
    scope: 'read,write',
    response_type: 'token',
    callback_method: 'fragment',
    return_url: targetReturnUrl,
  });

  return `https://trello.com/1/authorize?${params.toString()}`;
}

export async function fetchAuthorizedMember(
  token: string
): Promise<TrelloMemberProfile> {
  const params = new URLSearchParams({
    key: TRELLO_APP_KEY,
    token,
    fields: 'id,fullName,username',
  });

  const response = await fetch(
    `https://api.trello.com/1/members/me?${params.toString()}`
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Trello auth validation failed (${response.status}): ${text || response.statusText}`
    );
  }

  return (await response.json()) as TrelloMemberProfile;
}

export async function getAuthStatus(t: TrelloClient): Promise<AuthStatus> {
  if (!hasTrelloAppKey()) {
    return { state: 'missing-key' };
  }

  let token: string | null = null;
  try {
    token = await t.get<string | null>(
      'member',
      'private',
      'trello_token',
      null
    );
  } catch {
    // member storage read error
  }

  if (!token) {
    try {
      const restApi = t.getRestApi();
      if (await restApi.isAuthorized()) {
        token = await restApi.getToken();
      }
    } catch {
      // restApi may not be ready
    }
  }

  if (!token) {
    return { state: 'unauthorized' };
  }

  try {
    const member = await fetchAuthorizedMember(token);
    return { state: 'authorized', member, token };
  } catch {
    await disconnectTrello(t);
    return { state: 'unauthorized' };
  }
}

export async function authorizeTrello(
  t: TrelloClient
): Promise<{ member: TrelloMemberProfile; token: string }> {
  if (!hasTrelloAppKey()) {
    throw new Error('VITE_TRELLO_APP_KEY is not configured.');
  }

  const authUrl = buildTrelloAuthUrl();

  const token = await new Promise<string>((resolve, reject) => {
    let popupWinRef: Window | null = null;
    let isSettled = false;
    let closedCheckTimer: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      isSettled = true;
      if (closedCheckTimer) {
        clearInterval(closedCheckTimer);
        closedCheckTimer = null;
      }
    };

    setTimeout(() => {
      if (isSettled) return;
      if (!popupWinRef) {
        cleanup();
        reject(
          new Error(
            'Your browser blocked the authorization popup window. Please use the "Authorize in New Tab" option below.'
          )
        );
      } else {
        closedCheckTimer = setInterval(() => {
          if (popupWinRef?.closed) {
            cleanup();
            reject(
              new Error('Authorization popup was closed before completing.')
            );
          }
        }, 1000);
      }
    }, 400);

    t.authorize(authUrl, {
      height: 720,
      width: 600,
      validToken: (tok) => typeof tok === 'string' && tok.trim().length > 10,
      windowCallback: (win) => {
        popupWinRef = win;
      },
    })
      .then((tok) => {
        cleanup();
        resolve(tok);
      })
      .catch((err) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });

  if (!token) {
    throw new Error(
      'Authorization completed without returning a valid Trello token.'
    );
  }

  await t.set('member', 'private', 'trello_token', token);
  const member = await fetchAuthorizedMember(token);
  return { member, token };
}

export function extractTokenFromInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  const tokenMatch = trimmed.match(/token=([a-zA-Z0-9]+)/i);
  if (tokenMatch && tokenMatch[1]) {
    return tokenMatch[1];
  }
  return trimmed;
}

export async function saveManualToken(
  t: TrelloClient,
  rawToken: string
): Promise<{ member: TrelloMemberProfile; token: string }> {
  const token = extractTokenFromInput(rawToken);
  if (!token) {
    throw new Error('Please enter a valid Trello token or authorization URL.');
  }

  const member = await fetchAuthorizedMember(token);
  await t.set('member', 'private', 'trello_token', token);
  return { member, token };
}

export async function disconnectTrello(t: TrelloClient): Promise<void> {
  try {
    await t.remove('member', 'private', 'trello_token');
  } catch {
    // ignore
  }

  try {
    if (hasTrelloAppKey()) {
      await t.getRestApi().clearToken();
    }
  } catch {
    // ignore
  }
}
