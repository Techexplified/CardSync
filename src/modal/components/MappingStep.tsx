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

      {/* Mode Settings for Labels & Members */}
      {(hasLabelsMapped || hasMembersMapped) && (
        <div className="cs-subbox cs-stack-sm" style={{ marginTop: 4 }}>
          <div className="cs-label">Multi-Value Sync Settings</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {hasLabelsMapped && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Labels Update Mode
                </div>
                <div className="cs-radio-group">
                  <button
                    type="button"
                    className={`cs-radio-btn ${
                      mappingConfig.labelsMode === 'append' ? 'cs-radio-btn-active' : ''
                    }`}
                    onClick={() => handleLabelsModeChange('append')}
                  >
                    Merge (Keep existing + add new)
                  </button>
                  <button
                    type="button"
                    className={`cs-radio-btn ${
                      mappingConfig.labelsMode === 'replace' ? 'cs-radio-btn-active' : ''
                    }`}
                    onClick={() => handleLabelsModeChange('replace')}
                  >
                    Replace all existing
                  </button>
                </div>
              </div>
            )}

            {hasMembersMapped && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Members (Assignees) Mode
                </div>
                <div className="cs-radio-group">
                  <button
                    type="button"
                    className={`cs-radio-btn ${
                      mappingConfig.membersMode === 'append' ? 'cs-radio-btn-active' : ''
                    }`}
                    onClick={() => handleMembersModeChange('append')}
                  >
                    Merge (Keep existing + add new)
                  </button>
                  <button
                    type="button"
                    className={`cs-radio-btn ${
                      mappingConfig.membersMode === 'replace' ? 'cs-radio-btn-active' : ''
                    }`}
                    onClick={() => handleMembersModeChange('replace')}
                  >
                    Replace all existing
                  </button>
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

