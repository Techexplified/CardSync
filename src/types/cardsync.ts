export interface CsvRow {
  /** 1-based spreadsheet row number (row 1 is header, data starts at row 2). */
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedCsvData {
  fileName: string;
  fileSize: number;
  headers: string[];
  duplicateHeaders: string[];
  rows: CsvRow[];
  parseWarnings: string[];
}

export type TrelloFieldKey =
  | 'id'
  | 'name'
  | 'desc'
  | 'due'
  | 'idList'
  | 'labels'
  | 'members'
  | 'ignore';

export type MultiValueMode = 'replace' | 'append';

export interface ColumnMappingConfig {
  mappings: Record<string, TrelloFieldKey>;
  labelsMode: MultiValueMode;
  membersMode: MultiValueMode;
}

export interface TrelloFieldDefinition {
  key: TrelloFieldKey;
  label: string;
  shortLabel: string;
  description: string;
  isIdentifier?: boolean;
  isUpdatable?: boolean;
}

export interface MappingValidationResult {
  isValid: boolean;
  idHeader: string | null;
  updatableFields: TrelloFieldKey[];
  ignoredHeaders: string[];
  duplicateErrors: { field: TrelloFieldKey; fieldLabel: string; headers: string[] }[];
  errors: string[];
}

export interface FieldDiff {
  fieldKey: TrelloFieldKey;
  fieldLabel: string;
  currentValue: string;
  newValue: string;
  hasChanged: boolean;
}

export interface CardDiff {
  cardId: string;
  cardName: string;
  cardShortId?: number;
  rowNumber: number;
  selected: boolean;
  fieldDiffs: FieldDiff[];
  hasChanges: boolean;
  changeCount: number;
  /** Payload ready for PUT /1/cards/{id} execution */
  updatePayload: {
    name?: string;
    desc?: string;
    due?: string | null;
    idList?: string;
    idLabels?: string[];
    idMembers?: string[];
  };
}

export interface PreviewSummary {
  totalCards: number;
  changedCardsCount: number;
  unchangedCardsCount: number;
  selectedCount: number;
  totalFieldChanges: number;
  cardDiffs: CardDiff[];
}


