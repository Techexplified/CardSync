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
  let token: string | null;

  try {
    token = await t.authorize(authUrl, {
      height: 720,
      width: 600,
      validToken: (tok) => typeof tok === 'string' && tok.trim().length > 10,
    });
  } catch (authErr) {
    try {
      const restApi = t.getRestApi();
      await (restApi as unknown as {
        authorize: (opts: Record<string, unknown>) => Promise<void>;
      }).authorize({
        scope: 'read,write',
        expiration: '30days',
        returnUrl: `${window.location.origin}/auth.html`,
      });
      token = await restApi.getToken();
    } catch {
      throw authErr;
    }
  }

  if (!token) {
    throw new Error(
      'Authorization completed without returning a valid Trello token.'
    );
  }

  await t.set('member', 'private', 'trello_token', token);
  const member = await fetchAuthorizedMember(token);
  return { member, token };
}

export async function saveManualToken(
  t: TrelloClient,
  rawToken: string
): Promise<{ member: TrelloMemberProfile; token: string }> {
  const token = rawToken.trim();
  if (!token) {
    throw new Error('Please enter a valid Trello token.');
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
