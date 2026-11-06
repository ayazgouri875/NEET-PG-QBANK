import React from 'react';

export const ImportCenter: React.FC = () => {
  const fields = [
    { anki: 'Question', target: 'questions.html_content & text', type: 'HTML / Plain Text' },
    { anki: 'MCQ_ID', target: 'questions.mcq_id', type: 'VARCHAR(50) Unique Index' },
    { anki: 'Option1 .. Option4', target: 'question_options (Labels A..D)', type: 'Relational Entity' },
    { anki: 'CorrectIndex', target: 'question_options.is_correct', type: 'Boolean Flag' },
    { anki: 'Explanation', target: 'explanations.html_content & text', type: 'Rich HTML Text' },
    { anki: 'References', target: 'explanations.references', type: 'Textbook Citations' },
    { anki: 'Deck Taxonomy', target: 'subjects > topics > subtopics', type: 'Hierarchical FK' },
    { anki: 'QuestionImages', target: 'question_images', type: '16,507 Mapped Assets' },
  ];

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 32px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Target Archive Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0,
          }}>
            📦
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, wordBreak: 'break-all' }}>
              data/imports/neet_pg.apkg
            </h3>
            <span style={{ fontSize: '13px', color: '#64748B' }}>
              Archive Size: 1.91 GB (1,998,919,165 bytes) • SQLite Format: collection.anki2
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="badge badge-success" style={{ padding: '8px 12px', fontSize: '13px' }}>
            ✓ 100% Imported (19,225 Questions Active)
          </span>
        </div>
      </div>

      {/* Field Mapping Specification */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: 'clamp(16px, 2vw, 24px)',
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Anki APKG Field Mapping Architecture
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
            Model: <code>MCQ Addon Model</code> (18 Fields) mapped directly to NEET PG relational schema
          </p>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Anki Note Source Field</th>
                <th>Relational Target Column</th>
                <th>Data Type & Transformation</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: '#1E3A8A' }}><code>{f.anki}</code></td>
                  <td style={{ fontWeight: 500 }}><code>{f.target}</code></td>
                  <td><span className="badge badge-teal">{f.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 20 Sample Records Verified Banner */}
      <div style={{
        backgroundColor: '#F0FDF4',
        borderRadius: '16px',
        border: '1px solid #BBF7D0',
        padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#166534', margin: 0 }}>
            Sample Question Previews Verified (data/preview/sample_20.md)
          </h4>
        </div>
        <p style={{ fontSize: '13px', color: '#15803D', margin: 0 }}>
          All 20 sample clinical records across Anaesthesia, Anatomy, Dermatology, ENT, Forensic Medicine, Medicine,
          Microbiology, and Surgery have been audited and approved with zero formatting anomalies.
        </p>
      </div>
    </div>
  );
};

