import React, { useState } from 'react';
import { adminApi } from '../api';
import { UserItem } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserItem) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Sign-In Modal
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');

  // Handle Login with Registered Email & Password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both your email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await adminApi.login(email.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please check your credentials or create an account.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Direct Account Creation (Simple & Fast)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name or title (e.g. Dr. Ayaz).');
      return;
    }
    if (!email.trim()) {
      setError('Please enter a valid Gmail / email address.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const user = await adminApi.register(
        email.trim(),
        password,
        fullName.trim(),
        targetYear
      );
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth / Instant Profile Sign-In
  const handleGoogleSignIn = async (userEmail: string, userName?: string) => {
    try {
      setLoading(true);
      setError(null);
      const user = await adminApi.loginWithGoogle(userEmail.trim(), userName?.trim());
      setShowGoogleModal(false);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick One-Click User Switcher (Saves Separate Progress Per User)
  const handleQuickSwitch = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    try {
      setLoading(true);
      setError(null);
      const user = await adminApi.login(quickEmail, quickPass);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0F172A',
      backgroundImage: 'radial-gradient(ellipse at top, #1E293B 0%, #0F172A 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
      }}>
        {/* Brand Header */}
        <div style={{
          backgroundColor: '#F8FAFC',
          padding: '28px 32px 20px',
          textAlign: 'center',
          borderBottom: '1px solid #E2E8F0',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            margin: '0 auto 12px',
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
          }}>
            🩺
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            NEET PG Master
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0' }}>
            19 Subjects • 19,225 High-Yield Clinical MCQs
          </p>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            backgroundColor: '#E2E8F0',
            borderRadius: '8px',
            padding: '3px',
            marginTop: '18px',
          }}>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: mode === 'login' ? '#FFFFFF' : 'transparent',
                color: mode === 'login' ? '#0F172A' : '#64748B',
                boxShadow: mode === 'login' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: mode === 'register' ? '#FFFFFF' : 'transparent',
                color: mode === 'register' ? '#0F172A' : '#64748B',
                boxShadow: mode === 'register' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '28px 32px' }}>
          {/* Sign In with Google Button */}
          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '11px 16px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1E293B',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = '#94A3B8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FFFFFF';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
            </svg>
            <span>{mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            gap: '12px',
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
            <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>
              or continue with email
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#B91C1C',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. SIGN IN FORM                                           */}
          {/* ========================================================= */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Email Address / Gmail
                </label>
                <input
                  type="email"
                  required
                  placeholder="doctor@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#2563EB',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                  boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)',
                  marginTop: '4px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {loading ? 'Signing In...' : 'Sign In to Q-Bank'}
              </button>
            </form>
          ) : (
            /* ========================================================= */
            /* 2. CREATE ACCOUNT FORM (1-CLICK INSTANT REGISTRATION)     */
            /* ========================================================= */
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Full Name & Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Ayaz Gouri"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Gmail / Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Choose Password (min. 4 characters)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#2563EB',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Target Exam Year
                </label>
                <select
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                  }}
                >
                  <option value={2026}>NEET PG 2026</option>
                  <option value={2027}>NEET PG 2027</option>
                  <option value={2025}>INI-CET 2025</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: '#0D9488',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.8 : 1,
                  boxShadow: '0 4px 6px -1px rgba(13,148,136,0.3)',
                  marginTop: '4px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {loading ? 'Creating Account...' : 'Create Account & Start Practice →'}
              </button>
            </form>
          )}

          {/* Quick User Switcher Chips (Each user has their own separate progress) */}
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #F1F5F9',
          }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              ⚡ Quick User Switcher (Separate Progress)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuickSwitch('ayazgouri875@gmail.com', 'Password123!')}
                style={{
                  padding: '9px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#1E293B',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0D9488' }}>🩺 Dr. Ayaz Gouri</div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>ayazgouri875@gmail.com</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickSwitch('admin@neetpg.com', 'AdminPassword123')}
                style={{
                  padding: '9px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#1E293B',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 700, color: '#2563EB' }}>👨‍⚕️ Administrator</div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>admin@neetpg.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Google Sign-In Dialog Modal */}
      {showGoogleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <svg width="24" height="24" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
              </svg>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                  Sign in with Google
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Choose or enter any Google Account</span>
              </div>
            </div>

            {/* Quick Profile Select */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => handleGoogleSignIn('ayazgouri875@gmail.com', 'Dr. Ayaz Gouri')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#0D9488',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  AG
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Dr. Ayaz Gouri</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>ayazgouri875@gmail.com</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleGoogleSignIn('doctor.ayaz@gmail.com', 'Dr. Ayaz')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  DA
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>Dr. Ayaz</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>doctor.ayaz@gmail.com</div>
                </div>
              </button>
            </div>

            {/* Custom Google Email Input */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Or enter any other Google / Gmail address:
              </span>
              <input
                type="email"
                placeholder="new.student@gmail.com"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  marginBottom: '8px',
                }}
              />
              <input
                type="text"
                placeholder="Student Name (optional)"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!googleEmail.trim() || loading}
                onClick={() => handleGoogleSignIn(googleEmail, googleName)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: !googleEmail.trim() || loading ? 'not-allowed' : 'pointer',
                  opacity: !googleEmail.trim() || loading ? 0.6 : 1,
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
