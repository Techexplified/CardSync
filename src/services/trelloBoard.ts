import { TRELLO_APP_KEY } from '../config/trello';
import type {
  BoardSnapshot,
  TrelloBoard,
  TrelloBoardMember,
  TrelloCard,
  TrelloLabel,
  TrelloList,
} from '../types/trello';

async function trelloGet<T>(
  path: string,
  token: string,
  query: Record<string, string> = {}
): Promise<T> {
  const params = new URLSearchParams({
    key: TRELLO_APP_KEY,
    token,
    ...query,
  });

  const response = await fetch(
    `https://api.trello.com/1${path}?${params.toString()}`
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Trello API error (${response.status}): ${text || response.statusText}`
    );
  }

  return (await response.json()) as T;
}

export async function fetchBoardSnapshot(
  board: TrelloBoard,
  token: string
): Promise<BoardSnapshot> {
  const [cards, lists, labels, members] = await Promise.all([
    trelloGet<TrelloCard[]>(`/boards/${board.id}/cards/open`, token, {
      fields: 'id,idShort,shortLink,name,desc,due,idList,idLabels,idMembers,url',
    }),
    trelloGet<TrelloList[]>(`/boards/${board.id}/lists/open`, token, {
      fields: 'id,name',
    }),
    trelloGet<TrelloLabel[]>(`/boards/${board.id}/labels`, token, {
      fields: 'id,name,color',
      limit: '1000',
    }),
    trelloGet<TrelloBoardMember[]>(`/boards/${board.id}/members`, token, {
      fields: 'id,fullName,username',
    }),
  ]);

  return {
    board,
    cards,
    lists,
    labels,
    members,
    fetchedAt: new Date().toISOString(),
  };
}

