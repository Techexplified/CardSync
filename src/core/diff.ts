import type {
  CardDiff,
  ColumnMappingConfig,
  FieldDiff,
  ParsedCsvData,
} from '../types/cardsync';
import type { BoardSnapshot, TrelloCard } from '../types/trello';
import type { ValidatedRow } from './validator';

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

function parseDateIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = new Date(trimmed);
  if (!isNaN(iso.getTime())) {
    return iso.toISOString();
  }
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return '(none)';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

/**
 * Computes side-by-side diffs between existing Trello cards and incoming CSV values.
 */
export function computeCardDiffs(
  validatedRows: ValidatedRow[],
  csvData: ParsedCsvData,
  mappingConfig: ColumnMappingConfig,
  snapshot: BoardSnapshot
): CardDiff[] {
  // Index board data
  const listById = new Map(snapshot.lists.map((l) => [l.id, l.name]));
  const listByName = new Map(snapshot.lists.map((l) => [l.name.toLowerCase().trim(), l.id]));

  const labelById = new Map(
    snapshot.labels.map((l) => [l.id, l.name.trim() || l.color || l.id])
  );
  const labelByName = new Map<string, string>();
  for (const label of snapshot.labels) {
    if (label.name.trim()) {
      labelByName.set(label.name.toLowerCase().trim(), label.id);
    }
    if (label.color) {
      labelByName.set(label.color.toLowerCase().trim(), label.id);
    }
  }

  const memberById = new Map(snapshot.members.map((m) => [m.id, m.username]));
  const memberByUsername = new Map<string, string>();
  const memberByFullName = new Map<string, string>();
  for (const m of snapshot.members) {
    memberByUsername.set(m.username.toLowerCase().trim(), m.id);
    memberByFullName.set(m.fullName.toLowerCase().trim(), m.id);
  }

  const csvRowByNumber = new Map(csvData.rows.map((r) => [r.rowNumber, r]));

  const cardDiffs: CardDiff[] = [];

  for (const vRow of validatedRows) {
    const card: TrelloCard | null = vRow.matchedCard;
    if (!card) continue;

    const csvRow = csvRowByNumber.get(vRow.rowNumber);
    if (!csvRow) continue;

    const fieldDiffs: FieldDiff[] = [];
    const updatePayload: CardDiff['updatePayload'] = {};

    for (const [header, fieldKey] of Object.entries(mappingConfig.mappings)) {
      if (fieldKey === 'ignore' || fieldKey === 'id') continue;

      const rawCsvVal = (csvRow.values[header] ?? '').trim();

      // 1. Title / Name
      if (fieldKey === 'name') {
        const currentName = card.name ?? '';
        const newName = rawCsvVal;
        const hasChanged = newName.length > 0 && newName !== currentName;
        fieldDiffs.push({
          fieldKey: 'name',
          fieldLabel: 'Title',
          currentValue: currentName,
          newValue: newName || '(empty - will not change)',
          hasChanged,
        });
        if (hasChanged) {
          updatePayload.name = newName;
        }
      }

      // 2. Description
      if (fieldKey === 'desc') {
        const currentDesc = card.desc ?? '';
        const newDesc = rawCsvVal;
        const hasChanged = newDesc !== currentDesc;
        fieldDiffs.push({
          fieldKey: 'desc',
          fieldLabel: 'Description',
          currentValue: currentDesc || '(none)',
          newValue: newDesc || '(cleared)',
          hasChanged,
        });
        if (hasChanged) {
          updatePayload.desc = newDesc;
        }
      }

      // 3. Due Date
      if (fieldKey === 'due') {
        const currentDue = card.due ?? null;
        const currentDueDisplay = formatDateDisplay(currentDue);

        if (!rawCsvVal) {
          fieldDiffs.push({
            fieldKey: 'due',
            fieldLabel: 'Due Date',
            currentValue: currentDueDisplay,
            newValue: '(no change)',
            hasChanged: false,
          });
        } else {
          const parsedIso = parseDateIso(rawCsvVal);
          const newDueDisplay = formatDateDisplay(parsedIso);
          const hasChanged =
            parsedIso !== null &&
            (currentDue === null ||
              formatDateDisplay(currentDue) !== newDueDisplay);

          fieldDiffs.push({
            fieldKey: 'due',
            fieldLabel: 'Due Date',
            currentValue: currentDueDisplay,
            newValue: newDueDisplay,
            hasChanged,
          });
          if (hasChanged) {
            updatePayload.due = parsedIso;
          }
        }
      }

      // 4. List / Column
      if (fieldKey === 'idList') {
        const currentListId = card.idList ?? '';
        const currentListName = listById.get(currentListId) ?? '(unknown)';

        if (!rawCsvVal) {
          fieldDiffs.push({
            fieldKey: 'idList',
            fieldLabel: 'List',
            currentValue: currentListName,
            newValue: '(no change)',
            hasChanged: false,
          });
        } else {
          const targetListId = listByName.get(rawCsvVal.toLowerCase());
          const hasChanged = Boolean(targetListId && targetListId !== currentListId);
          fieldDiffs.push({
            fieldKey: 'idList',
            fieldLabel: 'List',
            currentValue: currentListName,
            newValue: rawCsvVal,
            hasChanged,
          });
          if (hasChanged && targetListId) {
            updatePayload.idList = targetListId;
          }
        }
      }

      // 5. Labels
      if (fieldKey === 'labels') {
        const currentLabelIds = card.idLabels ?? [];
        const currentLabelsDisplay =
          currentLabelIds.map((id) => labelById.get(id) ?? id).join(', ') ||
          '(none)';

        if (!rawCsvVal) {
          fieldDiffs.push({
            fieldKey: 'labels',
            fieldLabel: 'Labels',
            currentValue: currentLabelsDisplay,
            newValue: '(no change)',
            hasChanged: false,
          });
        } else {
          const rawItems = rawCsvVal.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          const resolvedNewIds = rawItems
            .map((name) => labelByName.get(name))
            .filter((id): id is string => Boolean(id));

          const targetLabelIds =
            mappingConfig.labelsMode === 'append'
              ? Array.from(new Set([...currentLabelIds, ...resolvedNewIds]))
              : resolvedNewIds;

          const hasChanged = !arraysEqual(currentLabelIds, targetLabelIds);
          const newLabelsDisplay =
            targetLabelIds.map((id) => labelById.get(id) ?? id).join(', ') ||
            '(none)';

          fieldDiffs.push({
            fieldKey: 'labels',
            fieldLabel: `Labels (${mappingConfig.labelsMode === 'append' ? 'Merge' : 'Replace'})`,
            currentValue: currentLabelsDisplay,
            newValue: newLabelsDisplay,
            hasChanged,
          });
          if (hasChanged) {
            updatePayload.idLabels = targetLabelIds;
          }
        }
      }

      // 6. Members
      if (fieldKey === 'members') {
        const currentMemberIds = card.idMembers ?? [];
        const currentMembersDisplay =
          currentMemberIds
            .map((id) => memberById.get(id) ?? id)
            .join(', ') || '(none)';

        if (!rawCsvVal) {
          fieldDiffs.push({
            fieldKey: 'members',
            fieldLabel: 'Members',
            currentValue: currentMembersDisplay,
            newValue: '(no change)',
            hasChanged: false,
          });
        } else {
          const rawItems = rawCsvVal.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
          const resolvedNewIds = rawItems
            .map((username) => memberByUsername.get(username) ?? memberByFullName.get(username))
            .filter((id): id is string => Boolean(id));

          const targetMemberIds =
            mappingConfig.membersMode === 'append'
              ? Array.from(new Set([...currentMemberIds, ...resolvedNewIds]))
              : resolvedNewIds;

          const hasChanged = !arraysEqual(currentMemberIds, targetMemberIds);
          const newMembersDisplay =
            targetMemberIds
              .map((id) => memberById.get(id) ?? id)
              .join(', ') || '(none)';

          fieldDiffs.push({
            fieldKey: 'members',
            fieldLabel: `Members (${mappingConfig.membersMode === 'append' ? 'Merge' : 'Replace'})`,
            currentValue: currentMembersDisplay,
            newValue: newMembersDisplay,
            hasChanged,
          });
          if (hasChanged) {
            updatePayload.idMembers = targetMemberIds;
          }
        }
      }
    }

    const changedDiffs = fieldDiffs.filter((f) => f.hasChanged);
    const hasChanges = changedDiffs.length > 0;

    cardDiffs.push({
      cardId: card.id,
      cardName: card.name,
      cardShortId: card.idShort,
      rowNumber: vRow.rowNumber,
      selected: hasChanges, // Only pre-check cards that actually have changes!
      fieldDiffs,
      hasChanges,
      changeCount: changedDiffs.length,
      updatePayload,
    });
  }

  return cardDiffs;
}

