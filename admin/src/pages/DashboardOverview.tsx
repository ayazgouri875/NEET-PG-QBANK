import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { AdminStats } from '../types';

export const DashboardOverview: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await adminApi.fetchStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '32px' }}>Loading Question Bank Statistics...</div>;
  }

  if (!stats) {
    return <div style={{ padding: '32px' }}>Unable to load dashboard data. Ensure backend is running.</div>;
  }

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 32px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={kpiCardStyle}>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>TOTAL QUESTIONS</span>
          <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1E3A8A', margin: '8px 0' }}>
            {stats.total_questions.toLocaleString()}
          </h3>
          <span className="badge badge-success">100% Verified MCQs</span>
        </div>

        <div style={kpiCardStyle}>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>CLINICAL SCENARIOS</span>
          <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#0D9488', margin: '8px 0' }}>
            {stats.clinical_questions.toLocaleString()}
          </h3>
          <span className="badge badge-teal">Case-Based Vignettes</span>
        </div>

        <div style={kpiCardStyle}>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>IMAGE QUESTIONS</span>
          <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#6366F1', margin: '8px 0' }}>
            {stats.image_based_questions.toLocaleString()}
          </h3>
          <span className="badge badge-purple">CT, X-Ray, Histology</span>
        </div>

        <div style={kpiCardStyle}>
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>PREVIOUS YEAR (PYQ)</span>
          <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#D97706', margin: '8px 0' }}>
            {stats.previous_year_questions.toLocaleString()}
          </h3>
          <span className="badge badge-warning">NEET PG / INI-CET</span>
        </div>
      </div>

      {/* 19 Subjects Breakdown */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
              Curriculum Distribution (All 19 NEET PG Subjects)
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              Denormalized question volume across Pre-clinical, Para-clinical, and Clinical disciplines
            </p>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A8A' }}>
            {stats.total_subjects} Subjects Active
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {stats.subject_breakdown.map((s) => {
            const pct = ((s.questions / stats.total_questions) * 100).toFixed(1);
            return (
              <div
                key={s.code}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>({s.code})</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>{s.category}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#0F172A' }}>
                    {s.questions.toLocaleString()}
                  </span>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Import Jobs */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '24px',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
          Recent APKG Import Batches
        </h3>
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Source Archive</th>
                <th>Status</th>
                <th>Imported Questions</th>
                <th>Duplicates Merged</th>
                <th>Failed Records</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_import_jobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 'bold' }}>#{j.id}</td>
                  <td>{j.file}</td>
                  <td><span className="badge badge-success">{j.status.toUpperCase()}</span></td>
                  <td style={{ fontWeight: 'bold', color: '#16A34A' }}>{j.imported.toLocaleString()}</td>
                  <td>{j.duplicates.toLocaleString()} (PYQ Tagged)</td>
                  <td>{j.failed}</td>
                  <td style={{ color: '#64748B', fontSize: '12px' }}>
                    {new Date(j.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  border: '1px solid #E2E8F0',
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

