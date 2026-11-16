import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  KeyRound,
  LayoutList,
  SlidersHorizontal,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import {
  exportBoardTemplateCsv,
  exportStarterTemplateCsv,
  parseCsvFile,
} from '../../core/csv';
import type { ParsedCsvData } from '../../types/cardsync';
import type { BoardSnapshot } from '../../types/trello';
import '../../styles/upload.css';

interface UploadStepProps {
  snapshot: BoardSnapshot | null;
  snapshotLoading: boolean;
  snapshotError: string | null;
  csvData: ParsedCsvData | null;
  onRefreshBoard: () => Promise<void>;
  onCsvLoaded: (data: ParsedCsvData) => void;
  onContinue: () => void;
}

const PREVIEW_ROW_LIMIT = 6;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function UploadStep({
  snapshot,
  snapshotLoading,
  snapshotError,
  csvData,
  onRefreshBoard,
  onCsvLoaded,
  onContinue,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [copiedListName, setCopiedListName] = useState<boolean>(false);
  const [cardSearch, setCardSearch] = useState<string>('');

  const cardCountByList = useMemo(() => {
    const map = new Map<string, number>();
    if (snapshot) {
      for (const card of snapshot.cards) {
        if (card.idList) {
          map.set(card.idList, (map.get(card.idList) ?? 0) + 1);
        }
      }
    }
    return map;
  }, [snapshot]);

  const selectedList = useMemo(() => {
    return snapshot?.lists.find((l) => l.id === selectedListId) ?? null;
  }, [snapshot, selectedListId]);

  const cardsInSelectedList = useMemo(() => {
    if (!snapshot || !selectedListId) return [];
    return snapshot.cards.filter((c) => c.idList === selectedListId);
  }, [snapshot, selectedListId]);

  const filteredCards = useMemo(() => {
    const q = cardSearch.trim().toLowerCase();
    if (!q) return cardsInSelectedList;
    return cardsInSelectedList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.idShort !== undefined && String(c.idShort).includes(q))
    );
  }, [cardsInSelectedList, cardSearch]);

  async function handleCopyCardId(cardId: string) {
    const ok = await copyTextToClipboard(cardId);
    if (ok) {
      setCopiedCardId(cardId);
      setTimeout(() => setCopiedCardId(null), 1800);
    }
  }

  async function handleCopyListName(name: string) {
    const ok = await copyTextToClipboard(name);
    if (ok) {
      setCopiedListName(true);
      setTimeout(() => setCopiedListName(false), 1800);
    }
  }

  async function processFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    setParsing(true);
    setParseError(null);
    try {
      const parsed = await parseCsvFile(file);
      if (parsed.headers.length === 0) {
        setParseError('No column headers were found in this CSV file.');
        return;
      }
      onCsvLoaded(parsed);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Unable to read CSV file.'
      );
    } finally {
      setParsing(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    void processFile(file);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    void processFile(file);
  }

  const canContinue = Boolean(
    csvData && csvData.headers.length > 0 && csvData.rows.length > 0 && snapshot
  );

  return (
    <div className="cs-stack-lg">
      {/* 1. Board Snapshot & Template Generator */}
      <section className="cs-card">
        <div className="cs-row">
          <div style={{ flex: '1 1 320px' }}>
            <h2 className="cs-card-title">Board Snapshot</h2>
            <p className="cs-card-desc">
              Live overview of cards and lists on this board. Download a pre-filled CSV template to edit cards directly.
            </p>
          </div>
          <div className="cs-actions">
            <button
              type="button"
              className="cs-btn cs-btn-subtle"
              disabled={snapshotLoading}
              onClick={() => void onRefreshBoard()}
            >
              {snapshotLoading ? 'Refreshing...' : '↻ Refresh Board'}
            </button>
          </div>
        </div>

        {snapshotError && (
          <div
            className="cs-alert cs-alert-error"
            role="alert"
            style={{ marginTop: 12 }}
          >
            {snapshotError}
          </div>
        )}

        {snapshot ? (
          <>
            <div className="cs-stats-grid">
              <div className="cs-stat-tile">
                <div className="cs-label">Open Cards</div>
                <div className="cs-stat-value">{snapshot.cards.length}</div>
              </div>
              <div className="cs-stat-tile">
                <div className="cs-label">Lists</div>
                <div className="cs-stat-value">{snapshot.lists.length}</div>
              </div>
              <div className="cs-stat-tile">
                <div className="cs-label">Labels</div>
                <div className="cs-stat-value">{snapshot.labels.length}</div>
              </div>
              <div className="cs-stat-tile">
                <div className="cs-label">Members</div>
                <div className="cs-stat-value">{snapshot.members.length}</div>
              </div>
            </div>

            {/* Template Box with Card ID and List Name */}
            <div className="cs-template-box">
              <div className="cs-template-box-content">
                <div className="cs-template-box-title">
                  <span>📥</span>
                  <span>Pre-Formatted CSV Templates</span>
                </div>
                <p className="cs-template-box-desc">
                  Includes exact <strong>Card ID</strong> and <strong>List Name</strong> columns for this board. Edit values directly in Excel or Google Sheets, then drop it below to update cards in-place.
                </p>
              </div>
              <div className="cs-template-actions">
                <button
                  type="button"
                  className="cs-btn cs-btn-sm"
                  disabled={snapshotLoading}
                  onClick={() => exportBoardTemplateCsv(snapshot)}
                  title="Download CSV containing all current cards on this board with real Card IDs and List Names"
                >
                  Download Board CSV ({snapshot.cards.length} cards)
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn-subtle cs-btn-sm"
                  onClick={() => exportStarterTemplateCsv(snapshot)}
                  title="Download a clean starter CSV file with sample rows"
                >
                  Sample Blank Template
                </button>
              </div>
            </div>

            {/* Available Lists Bar with Interactive Card Inspector */}
            {snapshot.lists.length > 0 && (
              <div className="cs-board-lists-bar">
                <div className="cs-board-lists-header">
                  <span className="cs-board-lists-title">Available Lists:</span>
                  <span className="cs-board-lists-hint">
                    (Click any list to inspect its cards & copy Card IDs)
                  </span>
                </div>

                <div className="cs-list-chips-wrap">
                  {snapshot.lists.map((l) => {
                    const count = cardCountByList.get(l.id) ?? 0;
                    const isSelected = selectedListId === l.id;
                    const isEmpty = count === 0;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        className={`cs-list-chip-btn ${
                          isSelected ? 'cs-list-chip-active' : isEmpty ? 'cs-list-chip-empty' : ''
                        }`}
                        onClick={() => {
                          setSelectedListId(isSelected ? null : l.id);
                          setCardSearch('');
                        }}
                        title={`Click to view cards in "${l.name}"`}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        </svg>
                        <span>{l.name}</span>
                        <span
                          className={`cs-list-chip-count ${
                            isSelected
                              ? 'cs-list-chip-count-active'
                              : isEmpty
                              ? 'cs-list-chip-count-zero'
                              : ''
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Collapsible Card Details Drawer for Selected List */}
                {selectedList && (
                  <div className="cs-list-details-panel">
                    <div className="cs-list-details-header">
                      <div className="cs-list-details-title">
                        <div className="cs-list-drawer-badge">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#0055cc"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                          </svg>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="cs-list-title-text">{selectedList.name}</span>
                            <span className="cs-list-count-badge">
                              {cardsInSelectedList.length} card
                              {cardsInSelectedList.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="cs-list-drawer-sub">
                            Click any Card ID or &ldquo;Copy ID&rdquo; to paste directly into your spreadsheet
                          </div>
                        </div>
                      </div>

                      <div className="cs-actions" style={{ alignItems: 'center' }}>
                        {cardsInSelectedList.length > 2 && (
                          <div className="cs-list-search-wrap">
                            <svg
                              className="cs-list-search-icon"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                              type="text"
                              className="cs-list-search-input"
                              placeholder="Filter cards..."
                              value={cardSearch}
                              onChange={(e) => setCardSearch(e.target.value)}
                              aria-label="Filter cards in this list"
                            />
                            {cardSearch && (
                              <button
                                type="button"
                                className="cs-list-search-clear"
                                onClick={() => setCardSearch('')}
                                title="Clear filter"
                                aria-label="Clear filter"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className={`cs-btn-copy-list ${copiedListName ? 'cs-btn-success' : ''}`}
                          onClick={() => void handleCopyListName(selectedList.name)}
                          title="Copy list name to clipboard for List Name column"
                        >
                          {copiedListName ? (
                            <>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              <span>Copy List Name</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="cs-drawer-close-btn"
                          onClick={() => setSelectedListId(null)}
                          title="Close card inspector"
                          aria-label="Close"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {cardsInSelectedList.length === 0 ? (
                      <div className="cs-list-empty">
                        No open cards in list &quot;{selectedList.name}&quot;.
                      </div>
                    ) : filteredCards.length === 0 ? (
                      <div className="cs-list-empty">
                        No cards match &quot;{cardSearch}&quot;.
                      </div>
                    ) : (
                      <div className="cs-table-wrap" style={{ maxHeight: 260 }}>
                        <table className="cs-table">
                          <thead>
                            <tr>
                              <th style={{ width: '42%' }}>Card Title</th>
                              <th style={{ width: '38%' }}>Card ID (For CSV Matching)</th>
                              <th style={{ width: '20%', textAlign: 'right' }}>Copy ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCards.map((card) => {
                              const isCopied = copiedCardId === card.id;
                              return (
                                <tr key={card.id}>
                                  <td>
                                    <div className="cs-card-table-title">{card.name}</div>
                                    <div className="cs-card-meta-row">
                                      {card.idShort && (
                                        <span className="cs-card-number-badge">
                                          #{card.idShort}
                                        </span>
                                      )}
                                      {card.due && (
                                        <span className="cs-card-due-badge">
                                          <svg
                                            width="10"
                                            height="10"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                          </svg>
                                          {card.due.slice(0, 10)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="cs-card-id-pill"
                                      onClick={() => void handleCopyCardId(card.id)}
                                      title="Click to copy Card ID"
                                    >
                                      <code>{card.id}</code>
                                      <svg
                                        width="11"
                                        height="11"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                      </svg>
                                    </button>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className={`cs-copy-action-btn ${
                                        isCopied ? 'cs-copy-action-copied' : ''
                                      }`}
                                      onClick={() => void handleCopyCardId(card.id)}
                                      title="Copy this Card ID to clipboard"
                                    >
                                      {isCopied ? (
                                        <>
                                          <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                          <span>Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                          </svg>
                                          <span>Copy ID</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          snapshotLoading && (
            <p className="cs-card-desc" style={{ marginTop: 12 }}>
              Loading board cards, lists, labels, and members...
            </p>
          )
        )}
      </section>

      {/* 2. CSV Import Requirements & Disclaimer */}
      <section className="cs-card cs-stack-md">
        <div>
          <h2 className="cs-card-title">CSV Import Requirements & Guidelines</h2>
          <p className="cs-card-desc">
            Review the supported columns and rules before uploading your spreadsheet.
          </p>
        </div>

        <div className="cs-guide-grid">
          <div className="cs-guide-card">
            <div className="cs-guide-card-top">
              <div className="cs-guide-icon-wrap cs-guide-icon-blue">
                <KeyRound size={17} strokeWidth={2.2} />
              </div>
              <div className="cs-guide-header-text">
                <span className="cs-guide-card-title">Card Identifier</span>
                <span className="cs-guide-badge cs-guide-badge-required">Required</span>
              </div>
            </div>
            <p className="cs-guide-text">
              Every row must have a <code>Card ID</code> (24-character Trello ID, card URL, or title) to locate and update the card in-place with zero duplicates.
            </p>
          </div>

          <div className="cs-guide-card">
            <div className="cs-guide-card-top">
              <div className="cs-guide-icon-wrap cs-guide-icon-purple">
                <LayoutList size={17} strokeWidth={2.2} />
              </div>
              <div className="cs-guide-header-text">
                <span className="cs-guide-card-title">List Name</span>
                <span className="cs-guide-badge cs-guide-badge-action">Move Cards</span>
              </div>
            </div>
            <p className="cs-guide-text">
              Use <code>List Name</code> to move cards to another list. The name must match an existing list on this board (e.g. {snapshot?.lists.slice(0, 2).map((l) => `"${l.name}"`).join(' or ') || '"To Do"'}).
            </p>
          </div>

          <div className="cs-guide-card">
            <div className="cs-guide-card-top">
              <div className="cs-guide-icon-wrap cs-guide-icon-green">
                <SlidersHorizontal size={17} strokeWidth={2.2} />
              </div>
              <div className="cs-guide-header-text">
                <span className="cs-guide-card-title">Selective Columns</span>
                <span className="cs-guide-badge cs-guide-badge-info">Flexible</span>
              </div>
            </div>
            <p className="cs-guide-text">
              Only include columns you wish to modify (<code>Card Name</code>, <code>Description</code>, <code>Due Date</code>, <code>Labels</code>, <code>Members</code>). Omitted or ignored columns are completely untouched.
            </p>
          </div>

          <div className="cs-guide-card">
            <div className="cs-guide-card-top">
              <div className="cs-guide-icon-wrap cs-guide-icon-amber">
                <CalendarDays size={17} strokeWidth={2.2} />
              </div>
              <div className="cs-guide-header-text">
                <span className="cs-guide-card-title">Dates & Formatting</span>
                <span className="cs-guide-badge cs-guide-badge-info">Syntax</span>
              </div>
            </div>
            <p className="cs-guide-text">
              Format <code>Due Date</code> as <code>YYYY-MM-DD</code>. Separate multiple labels or members with commas (e.g. <code>Urgent, Bug</code> or <code>@alice, @bob</code>).
            </p>
          </div>
        </div>

        <div className="cs-disclaimer-box" role="note">
          <div className="cs-disclaimer-icon-wrap">
            <ShieldAlert size={20} strokeWidth={2.2} />
          </div>
          <div className="cs-disclaimer-content">
            <div className="cs-disclaimer-title">IMPORTANT DISCLAIMER · SAFE IN-PLACE UPDATES</div>
            <p className="cs-disclaimer-text">
              <strong>In-Place Updates Only:</strong> CardSync modifies existing cards on this board. It will <strong>never create new cards</strong> or delete unlisted cards. Missing or invalid Card IDs will be flagged and safely skipped. You will review a complete side-by-side diff in Step 4 before changes are applied.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Upload CSV File */}

      <section className="cs-card cs-stack-md">
        <div>
          <h2 className="cs-card-title">Upload CSV File</h2>
          <p className="cs-card-desc">
            Select a spreadsheet containing a Card ID column and the fields you want
            to update.
          </p>
        </div>

        <div
          className={`cs-dropzone ${dragging ? 'cs-dropzone-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="cs-dropzone-icon">
            <UploadIcon />
          </div>
          <div className="cs-dropzone-title">
            {parsing
              ? 'Parsing CSV...'
              : csvData
                ? `${csvData.fileName} (${formatBytes(csvData.fileSize)})`
                : 'Drop your .csv file here, or click to browse'}
          </div>
          <div className="cs-dropzone-sub">
            Supports UTF-8 CSV files with quoted multiline descriptions, due dates,
            labels, and member usernames.
          </div>
        </div>

        {parseError && (
          <div className="cs-alert cs-alert-error" role="alert">
            {parseError}
          </div>
        )}

        {csvData && (
          <div className="cs-stack-md">
            <div className="cs-file-bar">
              <div className="cs-actions">
                <span className="cs-pill cs-pill-success">
                  {csvData.rows.length} rows
                </span>
                <span className="cs-pill cs-pill-info">
                  {csvData.headers.length} columns
                </span>
                <span className="cs-card-desc">{csvData.fileName}</span>
              </div>
              <button
                type="button"
                className="cs-btn cs-btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace CSV
              </button>
            </div>

            {csvData.duplicateHeaders.length > 0 && (
              <div className="cs-alert cs-alert-warning">
                Duplicate column headers detected (auto-renamed):{' '}
                {csvData.duplicateHeaders.join(', ')}
              </div>
            )}

            {csvData.parseWarnings.length > 0 && (
              <div className="cs-alert cs-alert-warning">
                CSV parser warnings: {csvData.parseWarnings.slice(0, 3).join(' | ')}
              </div>
            )}

            {csvData.rows.length === 0 ? (
              <div className="cs-alert cs-alert-error">
                This CSV file has headers but no data rows.
              </div>
            ) : (
              <div>
                <div className="cs-label">
                  Preview (first {Math.min(PREVIEW_ROW_LIMIT, csvData.rows.length)} of{' '}
                  {csvData.rows.length} rows)
                </div>
                <div className="cs-table-wrap">
                  <table className="cs-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        {csvData.headers.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="cs-row-num">{row.rowNumber}</td>
                          {csvData.headers.map((header) => (
                            <td key={header} title={row.values[header]}>
                              {row.values[header] || (
                                <span className="cs-cell-empty">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="cs-row" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cs-btn cs-btn-primary"
                disabled={!canContinue}
                onClick={onContinue}
              >
                Continue to Column Mapping &rarr;
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
