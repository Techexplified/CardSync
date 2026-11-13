import type { ColumnMappingConfig, CsvRow, ParsedCsvData } from '../types/cardsync';
import type { BoardSnapshot, TrelloCard } from '../types/trello';

export type RowStatus = 'valid' | 'warning' | 'error';

export interface RowIssue {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ValidatedRow {
  rowNumber: number;
  status: RowStatus;
  idRaw: string;
  matchedCard: TrelloCard | null;
  issues: RowIssue[];
}

export interface ValidationSummary {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  validatedRows: ValidatedRow[];
  /** All valid rows, skipping those with errors (but including warnings) */
  safeRows: ValidatedRow[];
}

/** Parse a date string loosely — returns null if unparseable. */
function parseDate(raw: string): Date | null {
  if (!raw.trim()) return null;
  // Try ISO 8601 or YYYY-MM-DD formats first
  const iso = new Date(raw.trim());
  if (!isNaN(iso.getTime())) return iso;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Builds lookup indexes from the board snapshot for fast matching.
 */
function buildBoardIndexes(snapshot: BoardSnapshot) {
  const cardById = new Map<string, TrelloCard>();
  const cardByShortLink = new Map<string, TrelloCard>();
  const cardByShortId = new Map<number, TrelloCard>();
  const listByName = new Map<string, string>(); // name (lowercase) → list id
  const listById = new Map<string, string>(); // id → name
  const labelByName = new Map<string, string>(); // name (lowercase) → label id
  const memberByUsername = new Map<string, string>(); // username (lowercase) → member id
  const memberByFullName = new Map<string, string>(); // fullname (lowercase) → member id
  const cardByName = new Map<string, TrelloCard>(); // name (lowercase) → card

  for (const card of snapshot.cards) {
    cardById.set(card.id, card);
    if (card.shortLink) cardByShortLink.set(card.shortLink, card);
    if (card.idShort !== undefined) cardByShortId.set(card.idShort, card);
    if (card.name) cardByName.set(card.name.toLowerCase().trim(), card);
  }
  for (const list of snapshot.lists) {
    listByName.set(list.name.toLowerCase().trim(), list.id);
    listById.set(list.id, list.name);
  }
  for (const label of snapshot.labels) {
    if (label.name.trim()) {
      labelByName.set(label.name.toLowerCase().trim(), label.id);
    }
    if (label.color) {
      labelByName.set(label.color.toLowerCase().trim(), label.id);
    }
  }
  for (const member of snapshot.members) {
    memberByUsername.set(member.username.toLowerCase().trim(), member.id);
    memberByFullName.set(member.fullName.toLowerCase().trim(), member.id);
  }

  return {
    cardById,
    cardByShortLink,
    cardByShortId,
    cardByName,
    listByName,
    listById,
    labelByName,
    memberByUsername,
    memberByFullName,
  };
}

/** Clean duplicate header suffixes like `(2)` or `(2) (2)` for human presentation */
export function cleanHeaderLabel(raw: string): string {
  return raw.replace(/\s*\(\d+\)/g, '').trim();
}

/**
 * Extracts a card identifier from a raw value (ID, short ID, URL, shortLink, or exact Card Name).
 */
function resolveCardFromRaw(
  raw: string,
  indexes: ReturnType<typeof buildBoardIndexes>
): TrelloCard | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. 24-char hex ID
  if (/^[a-f0-9]{24}$/i.test(trimmed)) {
    return indexes.cardById.get(trimmed) ?? null;
  }

  // 2. Trello card URL — extract shortLink or shortId
  const urlMatch = trimmed.match(/trello\.com\/c\/([a-zA-Z0-9]+)(?:\/(\d+))?/);
  if (urlMatch) {
    const byShortLink = indexes.cardByShortLink.get(urlMatch[1]);
    if (byShortLink) return byShortLink;
    if (urlMatch[2]) {
      const byId = indexes.cardByShortId.get(Number(urlMatch[2]));
      if (byId) return byId;
    }
  }

  // 3. 8-char shortLink
  if (/^[a-zA-Z0-9]{8}$/.test(trimmed)) {
    const byShortLink = indexes.cardByShortLink.get(trimmed);
    if (byShortLink) return byShortLink;
  }

  // 4. Numeric card # (with or without #)
  const numMatch = trimmed.match(/^#?(\d+)$/);
  if (numMatch) {
    return indexes.cardByShortId.get(Number(numMatch[1])) ?? null;
  }

  // 5. Fallback: match by exact card title (case-insensitive)
  const byName = indexes.cardByName.get(trimmed.toLowerCase());
  if (byName) {
    return byName;
  }

  return null;
}

/**
 * Validates a single CSV row against the board snapshot.
 */
function validateRow(
  row: CsvRow,
  config: ColumnMappingConfig,
  indexes: ReturnType<typeof buildBoardIndexes>
): ValidatedRow {
  const issues: RowIssue[] = [];
  let matchedCard: TrelloCard | null = null;

  // Find the ID header
  const idHeader = Object.entries(config.mappings).find(
    ([, field]) => field === 'id'
  )?.[0] ?? null;

  const cleanIdLabel = idHeader ? cleanHeaderLabel(idHeader) : 'Card ID';

  // --- Card Matching ---
  if (idHeader) {
    const rawId = row.values[idHeader] ?? '';
    if (!rawId.trim()) {
      issues.push({
        field: cleanIdLabel,
        message: 'Identifier is blank — cannot match this row to a card.',
        severity: 'error',
      });
    } else {
      matchedCard = resolveCardFromRaw(rawId, indexes);
      if (!matchedCard) {
        issues.push({
          field: cleanIdLabel,
          message: `No card on this board matches "${rawId}".`,
          severity: 'error',
        });
      }
    }
  }

  // If card was not found, don't spam secondary field warnings on a non-existent card
  if (!matchedCard) {
    const hasError = issues.some((i) => i.severity === 'error');
    const hasWarning = issues.some((i) => i.severity === 'warning');
    const status: RowStatus = hasError ? 'error' : hasWarning ? 'warning' : 'valid';
    return { rowNumber: row.rowNumber, status, idRaw: '', matchedCard: null, issues };
  }

  // --- Field-Level Validation (Only for matched cards) ---
  for (const [header, fieldKey] of Object.entries(config.mappings)) {
    if (fieldKey === 'ignore' || fieldKey === 'id') continue;
    const rawValue = row.values[header] ?? '';
    const cleanField = cleanHeaderLabel(header);

    if (fieldKey === 'due') {
      if (rawValue.trim()) {
        const parsed = parseDate(rawValue);
        if (!parsed) {
          issues.push({
            field: cleanField,
            message: `"${rawValue}" is an invalid date. Use YYYY-MM-DD.`,
            severity: 'error',
          });
        } else {
          const now = new Date();
          if (parsed < now) {
            issues.push({
              field: cleanField,
              message: `Due date "${rawValue}" is in the past.`,
              severity: 'warning',
            });
          }
        }
      }
    }

    if (fieldKey === 'idList') {
      if (rawValue.trim()) {
        const listId = indexes.listByName.get(rawValue.toLowerCase().trim());
        if (!listId) {
          issues.push({
            field: cleanField,
            message: `List "${rawValue}" does not exist on this board.`,
            severity: 'error',
          });
        }
      }
    }

    if (fieldKey === 'labels') {
      if (rawValue.trim()) {
        const labelNames = rawValue.split(',').map((l) => l.trim()).filter(Boolean);
        for (const name of labelNames) {
          if (!indexes.labelByName.has(name.toLowerCase())) {
            issues.push({
              field: cleanField,
              message: `Label "${name}" will be added as new or skipped.`,
              severity: 'warning',
            });
          }
        }
      }
    }

    if (fieldKey === 'members') {
      if (rawValue.trim()) {
        const memberNames = rawValue.split(',').map((m) => m.trim()).filter(Boolean);
        for (const name of memberNames) {
          const lc = name.toLowerCase();
          if (
            !indexes.memberByUsername.has(lc) &&
            !indexes.memberByFullName.has(lc)
          ) {
            issues.push({
              field: cleanField,
              message: `Member "${name}" is not on this board.`,
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  // Determine row status
  const hasError = issues.some((i) => i.severity === 'error');
  const hasWarning = issues.some((i) => i.severity === 'warning');
  const status: RowStatus = hasError ? 'error' : hasWarning ? 'warning' : 'valid';

  return { rowNumber: row.rowNumber, status, idRaw: '', matchedCard, issues };
}

/**
 * Runs full validation on the parsed CSV against the board snapshot.
 */
export function validateRows(
  csvData: ParsedCsvData,
  config: ColumnMappingConfig,
  snapshot: BoardSnapshot
): ValidationSummary {
  const indexes = buildBoardIndexes(snapshot);

  // Detect duplicate IDs in the CSV
  const idHeader = Object.entries(config.mappings).find(
    ([, field]) => field === 'id'
  )?.[0] ?? null;

  const idOccurrences = new Map<string, number[]>();
  if (idHeader) {
    for (const row of csvData.rows) {
      const rawId = row.values[idHeader]?.trim() ?? '';
      if (rawId) {
        const rows = idOccurrences.get(rawId) ?? [];
        rows.push(row.rowNumber);
        idOccurrences.set(rawId, rows);
      }
    }
  }

  const duplicateIdValues = new Set<string>(
    [...idOccurrences.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([id]) => id)
  );

  const validatedRows: ValidatedRow[] = csvData.rows.map((row) => {
    const result = validateRow(row, config, indexes);

    const rawId = idHeader ? (row.values[idHeader]?.trim() ?? '') : '';
    result.idRaw = rawId;

    // Add duplicate ID error
    if (rawId && duplicateIdValues.has(rawId)) {
      result.issues.unshift({
        field: idHeader ? cleanHeaderLabel(idHeader) : 'Card ID',
        message: `Duplicate: "${rawId}" appears on multiple rows. Only the first match will be processed.`,
        severity: 'error',
      });
      result.status = 'error';
    }

    return result;
  });

  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const warningCount = validatedRows.filter((r) => r.status === 'warning').length;
  const errorCount = validatedRows.filter((r) => r.status === 'error').length;

  return {
    totalRows: validatedRows.length,
    validCount,
    warningCount,
    errorCount,
    validatedRows,
    safeRows: validatedRows.filter((r) => r.status !== 'error'),
  };
}

