import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { SubjectItem } from '../types';

export const CategorizationManager: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Subject Form State
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Clinical');

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const data = await adminApi.fetchSubjects();
      setSubjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    try {
      await adminApi.createSubject({ name, code, category });
      setName('');
      setCode('');
      setShowAddSubject(false);
      loadSubjects();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 32px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
            NEET PG Curriculum Taxonomy (19 Subjects)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
            Pre-clinical (Year 1), Para-clinical (Year 2), and Clinical (Year 3 & 4) subjects
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddSubject(true)}>
          + Add New Subject
        </button>
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #CBD5E1',
          padding: '24px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
            Create New Subject Category
          </h4>
          <form onSubmit={handleCreateSubject} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Subject Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nuclear Medicine"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Code (Short)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. NUCL"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Discipline Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              >
                <option value="Pre-clinical">Pre-clinical</option>
                <option value="Para-clinical">Para-clinical</option>
                <option value="Clinical">Clinical</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddSubject(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Subject</button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading subjects...</div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Order</th>
                  <th style={{ width: '100px' }}>Code</th>
                  <th>Subject Name</th>
                  <th>Discipline Category</th>
                  <th style={{ textAlign: 'right' }}>Active Questions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 'bold', color: '#64748B' }}>#{s.display_order}</td>
                    <td><span className="badge badge-primary">{s.code}</span></td>
                    <td style={{ fontWeight: 600, fontSize: '15px' }}>{s.name}</td>
                    <td>
                      <span className={
                        s.category === 'Pre-clinical' ? 'badge badge-primary' :
                        s.category === 'Para-clinical' ? 'badge badge-purple' : 'badge badge-teal'
                      }>
                        {s.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }}>
                      {s.total_questions.toLocaleString()} MCQs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

