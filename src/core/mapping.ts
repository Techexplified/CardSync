import type {
  ColumnMappingConfig,
  MappingValidationResult,
  TrelloFieldDefinition,
  TrelloFieldKey,
} from '../types/cardsync';
import type { TrelloClient } from '../types/trello';

export const TRELLO_FIELDS: TrelloFieldDefinition[] = [
  {
    key: 'id',
    label: 'Card Identifier (Card ID / # / URL)',
    shortLabel: 'Card ID',
    description: 'Matches existing cards by 24-char ID, card #, or card URL.',
    isIdentifier: true,
  },
  {
    key: 'name',
    label: 'Card Title (Name)',
    shortLabel: 'Title',
    description: 'Updates the title/name of the card.',
    isUpdatable: true,
  },
  {
    key: 'desc',
    label: 'Description',
    shortLabel: 'Description',
    description: 'Updates the card description markdown text.',
    isUpdatable: true,
  },
  {
    key: 'due',
    label: 'Due Date',
    shortLabel: 'Due Date',
    description: 'Updates card due date (e.g. 2026-12-31 or ISO date).',
    isUpdatable: true,
  },
  {
    key: 'idList',
    label: 'List / Column (Move Card)',
    shortLabel: 'List',
    description: 'Moves card to target list matching list name or ID.',
    isUpdatable: true,
  },
  {
    key: 'labels',
    label: 'Labels',
    shortLabel: 'Labels',
    description: 'Comma-separated label names or colors.',
    isUpdatable: true,
  },
  {
    key: 'members',
    label: 'Members (Assignees)',
    shortLabel: 'Members',
    description: 'Comma-separated usernames or member full names.',
    isUpdatable: true,
  },
  {
    key: 'ignore',
    label: '— Ignore Column —',
    shortLabel: 'Ignored',
    description: 'Do not import or update this column.',
  },
];

export function getFieldDefinition(
  key: TrelloFieldKey
): TrelloFieldDefinition {
  return (
    TRELLO_FIELDS.find((field) => field.key === key) ?? {
      key: 'ignore',
      label: '— Ignore Column —',
      shortLabel: 'Ignored',
      description: 'Do not import or update this column.',
    }
  );
}

/**
 * Normalizes a header name for fuzzy matching (removes accents, punctuation, duplicate spaces).
 */
function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/\s*\(\d+\)$/, '') // remove auto-renamed suffix e.g. "Card ID (2)"
    .replace(/[^a-z0-9#\s_-]/g, ' ')
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

/**
 * Predicts the most likely Trello field for a given column header.
 */
export function detectTrelloField(rawHeader: string): TrelloFieldKey {
  const norm = normalizeHeader(rawHeader);

  // Card Identifier patterns
  if (
    norm === 'id' ||
    norm === 'card id' ||
    norm === 'card' ||
    norm === 'card #' ||
    norm === 'card no' ||
    norm === 'card number' ||
    norm === 'cardid' ||
    norm === 'shortlink' ||
    norm === 'card url' ||
    norm === 'trello id'
  ) {
    return 'id';
  }

  // Name / Title patterns
  if (
    norm === 'name' ||
    norm === 'title' ||
    norm === 'card name' ||
    norm === 'card title' ||
    norm === 'task' ||
    norm === 'task name' ||
    norm === 'task title' ||
    norm === 'item' ||
    norm === 'summary' ||
    norm === 'headline'
  ) {
    return 'name';
  }

  // Description patterns
  if (
    norm === 'description' ||
    norm === 'desc' ||
    norm === 'details' ||
    norm === 'notes' ||
    norm === 'card description' ||
    norm === 'card desc' ||
    norm === 'content' ||
    norm === 'body' ||
    norm === 'comment'
  ) {
    return 'desc';
  }

  // Due Date patterns
  if (
    norm === 'due' ||
    norm === 'due date' ||
    norm === 'duedate' ||
    norm === 'deadline' ||
    norm === 'target date' ||
    norm === 'target' ||
    norm === 'end date' ||
    norm === 'date'
  ) {
    return 'due';
  }

  // List / Stage patterns
  if (
    norm === 'list' ||
    norm === 'list name' ||
    norm === 'status' ||
    norm === 'stage' ||
    norm === 'column' ||
    norm === 'state' ||
    norm === 'phase'
  ) {
    return 'idList';
  }

  // Labels patterns
  if (
    norm === 'labels' ||
    norm === 'label' ||
    norm === 'tags' ||
    norm === 'tag' ||
    norm === 'categories' ||
    norm === 'category' ||
    norm === 'type'
  ) {
    return 'labels';
  }

  // Members patterns
  if (
    norm === 'members' ||
    norm === 'member' ||
    norm === 'assignee' ||
    norm === 'assignees' ||
    norm === 'assigned' ||
    norm === 'assigned to' ||
    norm === 'owner' ||
    norm === 'owners' ||
    norm === 'user' ||
    norm === 'users'
  ) {
    return 'members';
  }

  return 'ignore';
}

/**
 * Runs auto-detection for all headers, ensuring no two headers claim the same field.
 */
export function autoDetectMapping(
  headers: string[]
): Record<string, TrelloFieldKey> {
  const mappings: Record<string, TrelloFieldKey> = {};
  const claimedFields = new Set<TrelloFieldKey>();

  for (const header of headers) {
    const detected = detectTrelloField(header);
    if (detected !== 'ignore' && !claimedFields.has(detected)) {
      mappings[header] = detected;
      claimedFields.add(detected);
    } else {
      mappings[header] = 'ignore';
    }
  }

  return mappings;
}

/**
 * Creates an initial column mapping configuration for a set of headers.
 * Avoids mapping two headers to the same field during automatic detection.
 */
export function createInitialMapping(
  headers: string[],
  previousConfig?: ColumnMappingConfig | null
): ColumnMappingConfig {
  const mappings: Record<string, TrelloFieldKey> = {};
  const claimedFields = new Set<TrelloFieldKey>();

  // 1. First check if previous saved mapping has valid matches
  if (previousConfig?.mappings) {
    for (const header of headers) {
      const prevField = previousConfig.mappings[header];
      if (prevField && prevField !== 'ignore' && !claimedFields.has(prevField)) {
        mappings[header] = prevField;
        claimedFields.add(prevField);
      }
    }
  }

  // 2. Auto-detect for remaining unmapped headers
  for (const header of headers) {
    if (!mappings[header]) {
      const detected = detectTrelloField(header);
      if (detected !== 'ignore' && !claimedFields.has(detected)) {
        mappings[header] = detected;
        claimedFields.add(detected);
      } else {
        mappings[header] = 'ignore';
      }
    }
  }

  return {
    mappings,
    labelsMode: previousConfig?.labelsMode ?? 'append',
    membersMode: previousConfig?.membersMode ?? 'append',
  };
}

/**
 * Validates a mapping configuration and reports issues.
 */
export function validateMapping(
  headers: string[],
  config: ColumnMappingConfig
): MappingValidationResult {
  let idHeader: string | null = null;
  const updatableFields: TrelloFieldKey[] = [];
  const ignoredHeaders: string[] = [];
  const fieldToHeaders = new Map<TrelloFieldKey, string[]>();

  for (const header of headers) {
    const fieldKey = config.mappings[header] ?? 'ignore';

    if (fieldKey === 'ignore') {
      ignoredHeaders.push(header);
      continue;
    }

    const list = fieldToHeaders.get(fieldKey) ?? [];
    list.push(header);
    fieldToHeaders.set(fieldKey, list);

    if (fieldKey === 'id') {
      if (!idHeader) {
        idHeader = header;
      }
    } else {
      updatableFields.push(fieldKey);
    }
  }

  // Find duplicate mappings (fields mapped to more than 1 column)
  const duplicateErrors: {
    field: TrelloFieldKey;
    fieldLabel: string;
    headers: string[];
  }[] = [];

  for (const [fieldKey, mappedHeaders] of fieldToHeaders.entries()) {
    if (mappedHeaders.length > 1) {
      const def = getFieldDefinition(fieldKey);
      duplicateErrors.push({
        field: fieldKey,
        fieldLabel: def.shortLabel,
        headers: mappedHeaders,
      });
    }
  }

  const errors: string[] = [];

  if (!idHeader) {
    errors.push(
      'A Card Identifier column is required so CardSync knows which card to update.'
    );
  }

  if (updatableFields.length === 0) {
    errors.push(
      'At least one field to update (Title, Description, Due Date, List, Labels, or Members) must be mapped.'
    );
  }

  for (const dup of duplicateErrors) {
    errors.push(
      `"${dup.fieldLabel}" is mapped to multiple columns: ${dup.headers.join(', ')}.`
    );
  }

  const isValid =
    Boolean(idHeader) && updatableFields.length > 0 && duplicateErrors.length === 0;

  return {
    isValid,
    idHeader,
    updatableFields,
    ignoredHeaders,
    duplicateErrors,
    errors,
  };
}

const STORAGE_MAPPING_KEY = 'cardsync_last_mapping';

/**
 * Persists the user's mapping configuration in Trello board shared storage.
 */
export async function saveBoardMapping(
  t: TrelloClient,
  config: ColumnMappingConfig
): Promise<void> {
  try {
    await t.set('board', 'shared', STORAGE_MAPPING_KEY, config);
  } catch {
    // board storage save error (non-fatal)
  }
}

/**
 * Loads the user's previously used mapping configuration from Trello board shared storage.
 */
export async function loadBoardMapping(
  t: TrelloClient
): Promise<ColumnMappingConfig | null> {
  try {
    const saved = await t.get<ColumnMappingConfig | null>(
      'board',
      'shared',
      STORAGE_MAPPING_KEY,
      null
    );
    return saved;
  } catch {
    return null;
  }
}
