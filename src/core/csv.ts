import Papa from 'papaparse';
import type { CsvRow, ParsedCsvData } from '../types/cardsync';
import type { BoardSnapshot } from '../types/trello';

export function parseCsvFile(file: File): Promise<ParsedCsvData> {
  return new Promise((resolve, reject) => {
    const headerCounts = new Map<string, number>();
    const duplicateSet = new Set<string>();

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (rawHeader: string) => {
        const cleaned = rawHeader.replace(/^\uFEFF/, '').trim();
        if (!cleaned) return '';
        const count = (headerCounts.get(cleaned) ?? 0) + 1;
        headerCounts.set(cleaned, count);
        if (count > 1) {
          duplicateSet.add(cleaned);
          return `${cleaned} (${count})`;
        }
        return cleaned;
      },
      complete: (results) => {
        const headers = (results.meta.fields ?? []).filter(
          (field) => field.length > 0
        );

        const rows: CsvRow[] = results.data.map((raw, index) => {
          const values: Record<string, string> = {};
          for (const header of headers) {
            const val = raw[header];
            values[header] =
              val === null || val === undefined ? '' : String(val).trim();
          }
          return {
            rowNumber: index + 2,
            values,
          };
        });

        const parseWarnings = results.errors.map((err) => {
          const rowInfo =
            typeof err.row === 'number' ? `Row ${err.row + 2}: ` : '';
          return `${rowInfo}${err.message}`;
        });

        resolve({
          fileName: file.name,
          fileSize: file.size,
          headers,
          duplicateHeaders: Array.from(duplicateSet),
          rows,
          parseWarnings,
        });
      },
      error: (err) => {
        reject(new Error(err.message || 'Failed to parse CSV file.'));
      },
    });
  });
}

export function exportCsvFile(
  fileName: string,
  rows: Record<string, unknown>[]
): void {
  const csv = Papa.unparse(rows);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugifyBoardName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'trello-board';
}

export function exportBoardTemplateCsv(snapshot: BoardSnapshot): void {
  const listById = new Map(snapshot.lists.map((list) => [list.id, list.name]));
  const labelById = new Map(
    snapshot.labels.map((label) => [
      label.id,
      label.name.trim() || label.color || label.id,
    ])
  );
  const memberById = new Map(
    snapshot.members.map((member) => [member.id, member.username])
  );

  const rows = snapshot.cards.map((card) => ({
    'Card ID': card.id,
    'Card Name': card.name,
    'List Name': card.idList ? (listById.get(card.idList) ?? '') : '',
    Description: card.desc ?? '',
    'Due Date': card.due ? card.due.slice(0, 10) : '',
    Labels: (card.idLabels ?? [])
      .map((id) => labelById.get(id))
      .filter(Boolean)
      .join(', '),
    Members: (card.idMembers ?? [])
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .join(', '),
  }));

  const safeRows =
    rows.length > 0
      ? rows
      : [
          {
            'Card ID': '',
            'Card Name': '',
            'List Name': '',
            Description: '',
            'Due Date': '',
            Labels: '',
            Members: '',
          },
        ];

  const fileName = `${slugifyBoardName(snapshot.board.name)}-board-template.csv`;
  exportCsvFile(fileName, safeRows);
}

export function exportStarterTemplateCsv(snapshot?: BoardSnapshot | null): void {
  const firstList = snapshot?.lists?.[0]?.name || 'To Do';
  const secondList = snapshot?.lists?.[1]?.name || 'In Progress';
  const sampleLabel = snapshot?.labels?.[0]?.name || 'Urgent';
  const sampleMember = snapshot?.members?.[0]?.username || 'username';

  const rows = [
    {
      'Card ID': snapshot?.cards?.[0]?.id || '65a1b2c3d4e5f60718293a4b',
      'Card Name': snapshot?.cards?.[0]?.name || 'Example Card Title',
      'List Name': firstList,
      Description: 'Updated task description or notes...',
      'Due Date': '2026-12-31',
      Labels: sampleLabel,
      Members: sampleMember,
    },
    {
      'Card ID': snapshot?.cards?.[1]?.id || '65a1b2c3d4e5f60718293a4c',
      'Card Name': snapshot?.cards?.[1]?.name || 'Another Task to Move',
      'List Name': secondList,
      Description: 'Move this card to another list by editing List Name',
      'Due Date': '2026-11-20',
      Labels: '',
      Members: '',
    },
  ];

  const boardSlug = snapshot?.board?.name ? slugifyBoardName(snapshot.board.name) : 'trello';
  const fileName = `${boardSlug}-starter-template.csv`;
  exportCsvFile(fileName, rows);
}

