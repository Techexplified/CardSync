import { hasTrelloAppKey, TRELLO_APP_KEY } from '../config/trello';
import type { TrelloClient, TrelloMemberProfile } from '../types/trello';

export type AuthStatus =
  | { state: 'missing-key' }
  | { state: 'unauthorized' }
  | { state: 'authorized'; member: TrelloMemberProfile; token: string };

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
    throw new Error(`Trello auth check failed (${response.status})`);
  }

  return (await response.json()) as TrelloMemberProfile;
}

export async function getAuthStatus(t: TrelloClient): Promise<AuthStatus> {
  if (!hasTrelloAppKey()) {
    return { state: 'missing-key' };
  }

  const restApi = t.getRestApi();
  const isAuthorized = await restApi.isAuthorized();
  if (!isAuthorized) {
    return { state: 'unauthorized' };
  }

  const token = await restApi.getToken();
  if (!token) {
    return { state: 'unauthorized' };
  }

  try {
    const member = await fetchAuthorizedMember(token);
    return { state: 'authorized', member, token };
  } catch {
    await restApi.clearToken();
    return { state: 'unauthorized' };
  }
}

export async function authorizeTrello(
  t: TrelloClient
): Promise<{ member: TrelloMemberProfile; token: string }> {
  if (!hasTrelloAppKey()) {
    throw new Error('VITE_TRELLO_APP_KEY is not configured.');
  }

  const restApi = t.getRestApi();
  await restApi.authorize({
    scope: 'read,write',
    expiration: '30days',
  });

  const token = await restApi.getToken();
  if (!token) {
    throw new Error('Authorization completed without returning a Trello token.');
  }

  const member = await fetchAuthorizedMember(token);
  return { member, token };
}

export async function disconnectTrello(t: TrelloClient): Promise<void> {
  if (!hasTrelloAppKey()) return;
  await t.getRestApi().clearToken();
}

