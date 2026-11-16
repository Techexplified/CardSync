import { TRELLO_APP_KEY } from '../config/trello';
import { exportCsvFile } from './csv';
import type {
  CardDiff,
  ExecutionCardResult,
  ExecutionLogEntry,
  ExecutionReport,
} from '../types/cardsync';

const MAX_RETRIES = 3;
const DEFAULT_CONCURRENCY = 3;
const REQUEST_GAP_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFieldFriendlyName(fieldKey: string): string {
  switch (fieldKey) {
    case 'name':
      return 'Title';
    case 'desc':
      return 'Description';
    case 'due':
      return 'Due Date';
    case 'idList':
      return 'List';
    case 'idLabels':
      return 'Labels';
    case 'idMembers':
      return 'Members';
    default:
      return fieldKey;
  }
}

const TRELLO_LABEL_COLORS = [
  'blue',
  'green',
  'orange',
  'purple',
  'red',
  'yellow',
  'sky',
  'lime',
  'pink',
];

/**
 * Creates a missing label on a Trello board via REST API
 */
export async function createBoardLabel(
  boardId: string,
  name: string,
  token: string,
  colorIndex = 0,
  signal?: AbortSignal
): Promise<{ id: string; name: string; color: string | null }> {
  const color = TRELLO_LABEL_COLORS[colorIndex % TRELLO_LABEL_COLORS.length];
  const url = `https://api.trello.com/1/boards/${encodeURIComponent(
    boardId
  )}/labels?key=${TRELLO_APP_KEY}&token=${token}&name=${encodeURIComponent(
    name
  )}&color=${encodeURIComponent(color)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Failed to create label "${name}": ${errText || res.statusText}`
    );
  }

  return (await res.json()) as { id: string; name: string; color: string | null };
}

/**
 * Execute a single card update with retry and exponential backoff on HTTP 429
 */
export async function updateSingleCard(
  card: CardDiff,
  token: string,
  signal?: AbortSignal
): Promise<ExecutionCardResult> {
  const executedAt = new Date().toISOString();
  const payload = card.updatePayload;
  const updatedFieldKeys = Object.keys(payload);

  // If card has no field changes, skip calling Trello API
  if (updatedFieldKeys.length === 0) {
    return {
      cardId: card.cardId,
      cardName: card.cardName,
      cardShortId: card.cardShortId,
      rowNumber: card.rowNumber,
      status: 'skipped',
      updatedFields: [],
      error: 'No field changes detected (no-op)',
      executedAt,
    };
  }

  // Build JSON body for PUT /1/cards/{id}
  const bodyData: Record<string, unknown> = {};
  if (payload.name !== undefined) bodyData.name = payload.name;
  if (payload.desc !== undefined) bodyData.desc = payload.desc;
  if (payload.due !== undefined) bodyData.due = payload.due ?? '';
  if (payload.idList !== undefined) bodyData.idList = payload.idList;
  if (payload.idLabels !== undefined) bodyData.idLabels = payload.idLabels.join(',');
  if (payload.idMembers !== undefined) bodyData.idMembers = payload.idMembers.join(',');

  const url = `https://api.trello.com/1/cards/${encodeURIComponent(
    card.cardId
  )}?key=${TRELLO_APP_KEY}&token=${token}`;

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    if (signal?.aborted) {
      return {
        cardId: card.cardId,
        cardName: card.cardName,
        cardShortId: card.cardShortId,
        rowNumber: card.rowNumber,
        status: 'skipped',
        updatedFields: [],
        error: 'Execution cancelled by user',
        executedAt,
      };
    }

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(bodyData),
        signal,
      });

      if (response.ok) {
        return {
          cardId: card.cardId,
          cardName: card.cardName,
          cardShortId: card.cardShortId,
          rowNumber: card.rowNumber,
          status: 'success',
          updatedFields: updatedFieldKeys.map(getFieldFriendlyName),
          executedAt,
        };
      }

      // Handle Rate Limiting (429 Too Many Requests)
      if (response.status === 429) {
        attempt++;
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryDelay = retryAfterHeader
          ? Math.max(1000, parseInt(retryAfterHeader, 10) * 1000)
          : Math.min(6000, 1500 * Math.pow(2, attempt));

        if (attempt < MAX_RETRIES) {
          await sleep(retryDelay);
          continue;
        }
      }

      // Handle other non-ok HTTP statuses
      const errText = await response.text().catch(() => '');
      return {
        cardId: card.cardId,
        cardName: card.cardName,
        cardShortId: card.cardShortId,
        rowNumber: card.rowNumber,
        status: 'failed',
        updatedFields: [],
        error: `Trello error ${response.status}: ${errText || response.statusText}`,
        executedAt,
      };
    } catch (err) {
      if (signal?.aborted) {
        return {
          cardId: card.cardId,
          cardName: card.cardName,
          cardShortId: card.cardShortId,
          rowNumber: card.rowNumber,
          status: 'skipped',
          updatedFields: [],
          error: 'Execution cancelled by user',
          executedAt,
        };
      }

      attempt++;
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
        continue;
      }

      return {
        cardId: card.cardId,
        cardName: card.cardName,
        cardShortId: card.cardShortId,
        rowNumber: card.rowNumber,
        status: 'failed',
        updatedFields: [],
        error: err instanceof Error ? err.message : 'Network request failed',
        executedAt,
      };
    }
  }

  return {
    cardId: card.cardId,
    cardName: card.cardName,
    cardShortId: card.cardShortId,
    rowNumber: card.rowNumber,
    status: 'failed',
    updatedFields: [],
    error: 'Max retries exceeded',
    executedAt,
  };
}

export interface ExecutionOptions {
  boardId?: string;
  token: string;
  concurrency?: number;
  signal?: AbortSignal;
  onCardStart?: (card: CardDiff) => void;
  onCardComplete?: (result: ExecutionCardResult) => void;
  onLog?: (entry: ExecutionLogEntry) => void;
  onProgress?: (stats: {
    total: number;
    completed: number;
    success: number;
    failed: number;
    skipped: number;
  }) => void;
}

/**
 * Orchestrates parallel card updates with concurrency control and real-time reporting
 */
export async function runBatchExecution(
  cards: CardDiff[],
  options: ExecutionOptions
): Promise<ExecutionReport> {
  const {
    boardId,
    token,
    concurrency = DEFAULT_CONCURRENCY,
    signal,
    onCardStart,
    onCardComplete,
    onLog,
    onProgress,
  } = options;

  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const totalCards = cards.length;
  const results: ExecutionCardResult[] = [];

  let completedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  function pushLog(
    level: ExecutionLogEntry['level'],
    message: string,
    cardName?: string
  ) {
    if (onLog) {
      onLog({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        cardName,
      });
    }
  }

  // Pre-process and auto-create any missing labels on the board
  if (boardId) {
    const labelMap = new Map<string, string>(); // lowercase name -> label ID

    try {
      const labelsRes = await fetch(
        `https://api.trello.com/1/boards/${encodeURIComponent(
          boardId
        )}/labels?key=${TRELLO_APP_KEY}&token=${token}&limit=1000`,
        { signal }
      );
      if (labelsRes.ok) {
        const boardLabels = (await labelsRes.json()) as {
          id: string;
          name: string;
        }[];
        for (const l of boardLabels) {
          if (l.name) {
            labelMap.set(l.name.toLowerCase().trim(), l.id);
          }
        }
      }
    } catch {
      // Proceed with best effort if label fetching fails
    }

    // Collect all label names across cards that need to be created
    const missingLabelNames = new Set<string>();
    for (const card of cards) {
      if (card.updatePayload.labelNames) {
        for (const rawName of card.updatePayload.labelNames) {
          const lc = rawName.toLowerCase().trim();
          if (lc && !labelMap.has(lc)) {
            missingLabelNames.add(rawName.trim());
          }
        }
      }
    }

    if (missingLabelNames.size > 0) {
      pushLog(
        'info',
        `Auto-creating ${missingLabelNames.size} missing label${
          missingLabelNames.size === 1 ? '' : 's'
        } on Trello board...`
      );

      let colorIdx = 0;
      for (const name of Array.from(missingLabelNames)) {
        if (signal?.aborted) break;
        try {
          const newLabel = await createBoardLabel(
            boardId,
            name,
            token,
            colorIdx++,
            signal
          );
          labelMap.set(name.toLowerCase().trim(), newLabel.id);
          pushLog(
            'success',
            `Created board label "${name}" (${newLabel.color ?? 'default'})`
          );
        } catch (err) {
          pushLog(
            'warn',
            `Could not create board label "${name}": ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    }

    // Assign resolved label IDs to updatePayload.idLabels for each card
    for (const card of cards) {
      if (card.updatePayload.labelNames) {
        const finalIds: string[] = [];
        for (const name of card.updatePayload.labelNames) {
          const id = labelMap.get(name.toLowerCase().trim());
          if (id) {
            finalIds.push(id);
          }
        }
        card.updatePayload.idLabels = Array.from(new Set(finalIds));
      }
    }
  }

  pushLog(
    'info',
    `Starting sync execution for ${totalCards} cards (concurrency: ${concurrency})...`
  );

  let nextIndex = 0;

  async function worker() {
    while (nextIndex < totalCards) {
      if (signal?.aborted) {
        break;
      }

      const currentIndex = nextIndex++;
      const card = cards[currentIndex];

      if (onCardStart) {
        onCardStart(card);
      }

      await sleep(REQUEST_GAP_MS);

      const result = await updateSingleCard(card, token, signal);
      results.push(result);
      completedCount++;

      if (result.status === 'success') {
        successCount++;
        pushLog(
          'success',
          `Updated fields: ${result.updatedFields.join(', ')}`,
          card.cardName
        );
      } else if (result.status === 'skipped') {
        skippedCount++;
        pushLog('info', `Skipped: ${result.error}`, card.cardName);
      } else {
        failedCount++;
        pushLog('error', `Failed: ${result.error}`, card.cardName);
      }

      if (onCardComplete) {
        onCardComplete(result);
      }

      if (onProgress) {
        onProgress({
          total: totalCards,
          completed: completedCount,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount,
        });
      }
    }
  }

  // Spawn pool of worker promises
  const activeWorkers = Math.min(concurrency, totalCards);
  const pool = Array.from({ length: activeWorkers }, () => worker());
  await Promise.all(pool);

  // If aborted, mark unstarted cards as skipped
  if (signal?.aborted && results.length < totalCards) {
    const executedCardIds = new Set(results.map((r) => r.cardId));
    for (const card of cards) {
      if (!executedCardIds.has(card.cardId)) {
        const skippedResult: ExecutionCardResult = {
          cardId: card.cardId,
          cardName: card.cardName,
          cardShortId: card.cardShortId,
          rowNumber: card.rowNumber,
          status: 'skipped',
          updatedFields: [],
          error: 'Execution cancelled before card was reached',
          executedAt: new Date().toISOString(),
        };
        results.push(skippedResult);
        skippedCount++;
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  pushLog(
    failedCount === 0 ? 'success' : 'warn',
    `Execution finished in ${(durationMs / 1000).toFixed(
      1
    )}s: ${successCount} updated, ${failedCount} failed, ${skippedCount} skipped.`
  );

  return {
    startedAt,
    finishedAt,
    durationMs,
    totalCards,
    successCount,
    failedCount,
    skippedCount,
    results: results.sort((a, b) => a.rowNumber - b.rowNumber),
  };
}

/**
 * Generates and triggers browser download of an execution CSV report
 */
export function exportExecutionReportCsv(
  report: ExecutionReport,
  boardName = 'trello-board'
): void {
  const safeBoardName = boardName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'board';
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `cardsync-report-${safeBoardName}-${dateStr}.csv`;

  const rows = report.results.map((r) => ({
    'Row Number': r.rowNumber,
    'Card ID': r.cardId,
    'Card #': r.cardShortId ? `#${r.cardShortId}` : '',
    'Card Name': r.cardName,
    Status: r.status.toUpperCase(),
    'Fields Updated': r.updatedFields.join(', ') || '(none)',
    'Error Details': r.error || '',
    'Executed At': r.executedAt,
  }));

  exportCsvFile(fileName, rows);
}

