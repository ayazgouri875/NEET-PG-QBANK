import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { AuthSessionItem, UserItem } from '../types';

interface AccountModalProps {
  user: UserItem;
  onClose: () => void;
  onUserUpdated: (user: UserItem) => void;
  onLoggedOutAll: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  user,
  onClose,
  onUserUpdated,
  onLoggedOutAll,
}) => {
  const [tab, setTab] = useState<'profile' | 'security'>('profile');

  // Profile state
  const [fullName, setFullName] = useState(user.full_name || '');
  const [targetYear, setTargetYear] = useState<number>(user.target_exam_year || 2026);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState<AuthSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'security') {
      loadSessions();
    }
  }, [tab]);

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const list = await adminApi.fetchSessions();
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updated = await adminApi.updateProfile({
        full_name: fullName.trim(),
        target_exam_year: targetYear,
      });
      onUserUpdated(updated);
      setSuccess('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('New password must be at least 8 characters with uppercase, lowercase, and numbers.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const updatedUser = await adminApi.changePassword(currentPassword, newPassword);
      onUserUpdated(updatedUser);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess('Password updated. All other sessions have been signed out.');
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    try {
      await adminApi.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      setError(err.message || 'Could not revoke session.');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await adminApi.logoutAllDevices();
      onLoggedOutAll();
    } catch {
      onLoggedOutAll();
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#F8FAFC',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              Account & Security
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
              {user.email}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: '#64748B',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 24px', gap: '16px' }}>
          <button
            type="button"
            onClick={() => { setTab('profile'); setError(null); setSuccess(null); }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'profile' ? '2px solid #0D9488' : '2px solid transparent',
              color: tab === 'profile' ? '#0F172A' : '#64748B',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Profile Details
          </button>
          <button
            type="button"
            onClick={() => { setTab('security'); setError(null); setSuccess(null); }}
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'security' ? '2px solid #0D9488' : '2px solid transparent',
              color: tab === 'security' ? '#0F172A' : '#64748B',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Password & Active Sessions
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#B91C1C',
              fontSize: '12px',
              marginBottom: '14px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              color: '#166534',
              fontSize: '12px',
              marginBottom: '14px',
            }}>
              ✓ {success}
            </div>
          )}

          {tab === 'profile' ? (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Full Name & Title
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Target Exam Year
                </label>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
                  style={inputStyle}
                >
                  <option value={2026}>NEET PG 2026</option>
                  <option value={2027}>NEET PG 2027</option>
                  <option value={2025}>INI-CET 2025</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0D9488',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Change Password */}
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Change Password
                </h4>
                <input
                  type="password"
                  required
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  required
                  placeholder="New password (min 8 chars, letters & numbers)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </form>

              {/* Active Sessions */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                    Active Sessions ({sessions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleLogoutAll}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #FCA5A5',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Sign Out All Devices
                  </button>
                </div>

                {sessionsLoading ? (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Loading sessions...</div>
                ) : sessions.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>No tracked refresh sessions found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#F8FAFC',
                          gap: '8px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.user_agent || 'Web Session'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>
                            IP: {s.ip_address || 'unknown'} • Started {new Date(s.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(s.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
