import { useMemo } from 'react';
import {
  TRELLO_FIELDS,
  autoDetectMapping,
  validateMapping,
} from '../../core/mapping';
import type {
  ColumnMappingConfig,
  MultiValueMode,
  ParsedCsvData,
  TrelloFieldKey,
} from '../../types/cardsync';

interface MappingStepProps {
  csvData: ParsedCsvData;
  mappingConfig: ColumnMappingConfig;
  onMappingChange: (config: ColumnMappingConfig) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function MappingStep({
  csvData,
  mappingConfig,
  onMappingChange,
  onBack,
  onContinue,
}: MappingStepProps) {
  const validation = useMemo(
    () => validateMapping(csvData.headers, mappingConfig),
    [csvData.headers, mappingConfig]
  );

  const hasLabelsMapped = useMemo(
    () =>
      Object.values(mappingConfig.mappings).some(
        (field) => field === 'labels'
      ),
    [mappingConfig.mappings]
  );

  const hasMembersMapped = useMemo(
    () =>
      Object.values(mappingConfig.mappings).some(
        (field) => field === 'members'
      ),
    [mappingConfig.mappings]
  );

  function handleFieldChange(header: string, newField: TrelloFieldKey) {
    onMappingChange({
      ...mappingConfig,
      mappings: {
        ...mappingConfig.mappings,
        [header]: newField,
      },
    });
  }

  function handleLabelsModeChange(mode: MultiValueMode) {
    onMappingChange({
      ...mappingConfig,
      labelsMode: mode,
    });
  }

  function handleMembersModeChange(mode: MultiValueMode) {
    onMappingChange({
      ...mappingConfig,
      membersMode: mode,
    });
  }

  function handleAutoDetectAll() {
    const detected = autoDetectMapping(csvData.headers);
    onMappingChange({
      ...mappingConfig,
      mappings: detected,
    });
  }

  function handleSetAllIgnore() {
    const ignored: Record<string, TrelloFieldKey> = {};
    for (const h of csvData.headers) {
      ignored[h] = 'ignore';
    }
    onMappingChange({
      ...mappingConfig,
      mappings: ignored,
    });
  }

  /**
   * Extracts up to 3 non-empty sample values from the loaded CSV rows for a header.
   */
  function getSampleValues(header: string): string[] {
    const samples: string[] = [];
    for (const row of csvData.rows) {
      const val = row.values[header]?.trim();
      if (val && !samples.includes(val)) {
        samples.push(val);
      }
      if (samples.length >= 3) break;
    }
    return samples;
  }

  return (
    <section className="cs-card cs-stack-md" aria-labelledby="step2-title">
      {/* Top Header & Toolbar */}
      <div className="cs-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 id="step2-title" className="cs-card-title">
            Step 2: Column Mapping
          </h2>
          <p className="cs-card-desc">
            Map columns from <strong>{csvData.fileName}</strong> ({csvData.headers.length} columns) to Trello card fields. Exactly one Card Identifier is required to match cards.
          </p>
        </div>
        <div className="cs-actions">
          <button
            type="button"
            className="cs-btn cs-btn-sm"
            onClick={handleAutoDetectAll}
            title="Automatically guess matching Trello fields from header names"
          >
            Auto-Detect All
          </button>
          <button
            type="button"
            className="cs-btn cs-btn-subtle cs-btn-sm"
            onClick={handleSetAllIgnore}
            title="Set all columns to Ignore"
          >
            Set All to Ignore
          </button>
        </div>
      </div>

      {/* Validation Status Banner */}
      {!validation.isValid ? (
        <div className="cs-alert cs-alert-warning" role="alert">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Please resolve the following before continuing:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="cs-alert"
          style={{
            background: 'var(--cs-success-soft)',
            border: '1px solid #baf3db',
            color: 'var(--cs-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span className="cs-dot" style={{ background: 'var(--cs-success)' }} />
          <span>
            <strong>Mapping Ready:</strong> Card Identifier mapped to{' '}
            <code>{validation.idHeader}</code> + {validation.updatableFields.length}{' '}
            field{validation.updatableFields.length === 1 ? '' : 's'} set to update.
          </span>
        </div>
      )}

      {/* Mapping Table */}
      <div className="cs-table-wrap" style={{ maxHeight: 420 }}>
        <table className="cs-table">
          <thead>
            <tr>
              <th style={{ width: '38%' }}>CSV Column & Samples</th>
              <th style={{ width: '4%', textAlign: 'center' }}></th>
              <th style={{ width: '40%' }}>Trello Card Field</th>
              <th style={{ width: '18%', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {csvData.headers.map((header) => {
              const currentField = mappingConfig.mappings[header] ?? 'ignore';
              const samples = getSampleValues(header);
              const isId = currentField === 'id';
              const isUpdatable = currentField !== 'ignore' && !isId;

              const selectClass = isId
                ? 'cs-select cs-select-id'
                : isUpdatable
                ? 'cs-select cs-select-updatable'
                : 'cs-select cs-select-ignore';

              return (
                <tr key={header}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--cs-text)', marginBottom: 4 }}>
                      {header}
                    </div>
                    <div className="cs-samples-container">
                      {samples.length > 0 ? (
                        samples.map((sample, sIdx) => (
                          <span key={sIdx} className="cs-sample-chip" title={sample}>
                            {sample}
                          </span>
                        ))
                      ) : (
                        <span className="cs-sample-chip cs-sample-chip-empty">
                          empty column
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ textAlign: 'center', color: 'var(--cs-text-muted)' }}>
                    &rarr;
                  </td>

                  <td>
                    <select
                      className={selectClass}
                      value={currentField}
                      onChange={(e) =>
                        handleFieldChange(header, e.target.value as TrelloFieldKey)
                      }
                      aria-label={`Map column ${header}`}
                    >
                      {TRELLO_FIELDS.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    {isId && (
                      <span
                        className="cs-mapping-header-pill"
                        style={{ background: '#e9f2ff', color: '#0055cc' }}
                      >
                        Identifier ★
                      </span>
                    )}
                    {isUpdatable && (
                      <span
                        className="cs-mapping-header-pill"
                        style={{ background: '#dcfff1', color: '#1f845a' }}
                      >
                        Updates Field
                      </span>
                    )}
                    {!isId && !isUpdatable && (
                      <span
                        className="cs-mapping-header-pill"
                        style={{ background: '#f1f2f4', color: '#626f86' }}
                      >
                        Ignored
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Settings for Labels & Members */}
      {(hasLabelsMapped || hasMembersMapped) && (
        <div className="cs-stack-sm" style={{ marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            {hasLabelsMapped && (
              <div className="cs-sync-card">
                <div className="cs-sync-title">🏷️ Labels Update Behavior</div>
                <div className="cs-sync-desc">
                  Choose how labels from your spreadsheet affect existing card labels:
                </div>
                <div className="cs-sync-options-row">
                  <div
                    className={`cs-sync-choice ${
                      mappingConfig.labelsMode === 'append' ? 'cs-sync-choice-active' : ''
                    }`}
                    onClick={() => handleLabelsModeChange('append')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleLabelsModeChange('append')}
                  >
                    <div className="cs-sync-radio-dot">
                      {mappingConfig.labelsMode === 'append' && <div className="cs-sync-radio-inner" />}
                    </div>
                    <div>
                      <div className="cs-sync-choice-label">
                        Merge 
                      </div>
                      <div className="cs-sync-choice-detail">
                        Keep existing labels and add new ones from CSV.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`cs-sync-choice ${
                      mappingConfig.labelsMode === 'replace' ? 'cs-sync-choice-active' : ''
                    }`}
                    onClick={() => handleLabelsModeChange('replace')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleLabelsModeChange('replace')}
                  >
                    <div className="cs-sync-radio-dot">
                      {mappingConfig.labelsMode === 'replace' && <div className="cs-sync-radio-inner" />}
                    </div>
                    <div>
                      <div className="cs-sync-choice-label">Replace All</div>
                      <div className="cs-sync-choice-detail">
                        Remove old labels and set only the ones from CSV.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasMembersMapped && (
              <div className="cs-sync-card">
                <div className="cs-sync-title">👤 Members (Assignees) Behavior</div>
                <div className="cs-sync-desc">
                  Choose how assignees from your spreadsheet affect existing card members:
                </div>
                <div className="cs-sync-options-row">
                  <div
                    className={`cs-sync-choice ${
                      mappingConfig.membersMode === 'append' ? 'cs-sync-choice-active' : ''
                    }`}
                    onClick={() => handleMembersModeChange('append')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleMembersModeChange('append')}
                  >
                    <div className="cs-sync-radio-dot">
                      {mappingConfig.membersMode === 'append' && <div className="cs-sync-radio-inner" />}
                    </div>
                    <div>
                      <div className="cs-sync-choice-label">
                        Merge 
                      </div>
                      <div className="cs-sync-choice-detail">
                        Keep current assignees and add new ones from CSV.
                      </div>
                    </div>
                  </div>

                  <div
                    className={`cs-sync-choice ${
                      mappingConfig.membersMode === 'replace' ? 'cs-sync-choice-active' : ''
                    }`}
                    onClick={() => handleMembersModeChange('replace')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleMembersModeChange('replace')}
                  >
                    <div className="cs-sync-radio-dot">
                      {mappingConfig.membersMode === 'replace' && <div className="cs-sync-radio-inner" />}
                    </div>
                    <div>
                      <div className="cs-sync-choice-label">Replace All</div>
                      <div className="cs-sync-choice-detail">
                        Unassign everyone and assign only members from CSV.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="cs-row" style={{ marginTop: 12 }}>
        <button type="button" className="cs-btn" onClick={onBack}>
          &larr; Back to CSV Upload
        </button>

        <button
          type="button"
          className="cs-btn cs-btn-primary"
          disabled={!validation.isValid}
          onClick={onContinue}
        >
          Continue to Step 3: Validation &rarr;
        </button>
      </div>
    </section>
  );
}

