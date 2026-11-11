import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../api';
import { AuthConfig, UserItem } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserItem) => void;
}

type AuthView =
  | 'login'
  | 'register'
  | 'verify-pending'
  | 'verify-result'
  | 'forgot'
  | 'reset';

const resolveInitialView = (): { view: AuthView; token: string } => {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token') || '';

  if (path.includes('verify-email') && urlToken) {
    return { view: 'verify-result', token: urlToken };
  }
  if (path.includes('reset-password') && urlToken) {
    return { view: 'reset', token: urlToken };
  }
  if (path.includes('forgot-password')) {
    return { view: 'forgot', token: '' };
  }
  if (path.includes('register')) {
    return { view: 'register', token: '' };
  }
  return { view: 'login', token: '' };
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const initial = resolveInitialView();
  const [view, setView] = useState<AuthView>(initial.view);
  const [urlToken, setUrlToken] = useState<string>(initial.token);

  const [authConfig, setAuthConfig] = useState<AuthConfig>({
    google_enabled: false,
    google_client_id: null,
    email_verification_enabled: true,
    email_otp_enabled: true,
  });

  // Form Fields
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsVerificationPrompt, setNeedsVerificationPrompt] = useState(false);

  // Email verification token state
  const [verifyState, setVerifyState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [verifyMessage, setVerifyMessage] = useState<string>('Verifying your email address...');
  const [resetDone, setResetDone] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const verifyTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    adminApi.fetchAuthConfig().then(setAuthConfig).catch(() => {});
  }, []);

  // Automatically verify email token when landing on /verify-email?token=...
  useEffect(() => {
    if (view !== 'verify-result' || !urlToken || verifyTriggeredRef.current) return;
    verifyTriggeredRef.current = true;
    setVerifyState('verifying');
    adminApi
      .verifyEmailToken(urlToken)
      .then((res) => {
        setVerifyState('success');
        setVerifyMessage(res.message);
      })
      .catch((err: any) => {
        setVerifyState('error');
        setVerifyMessage(err.message || 'Invalid or expired verification link.');
      });
  }, [view, urlToken]);

  // Real Google Sign-In initialization when configured
  useEffect(() => {
    if (!authConfig.google_enabled || !authConfig.google_client_id) return;
    if (view !== 'login' && view !== 'register') return;

    const initGoogleButton = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: authConfig.google_client_id,
        callback: async (response: { credential?: string }) => {
          if (!response?.credential) {
            setError('Google authentication did not return a valid credential.');
            return;
          }
          try {
            setLoading(true);
            setError(null);
            const user = await adminApi.loginWithGoogleToken(response.credential);
            onLoginSuccess(user);
          } catch (err: any) {
            setError(err.message || 'Google sign-in failed.');
          } finally {
            setLoading(false);
          }
        },
      });
      googleBtnRef.current.innerHTML = '';
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: view === 'login' ? 'signin_with' : 'signup_with',
      });
    };

    if ((window as any).google?.accounts?.id) {
      initGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogleButton;
    document.body.appendChild(script);
  }, [authConfig, view, onLoginSuccess]);

  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const isPasswordStrong = hasMinLen && hasUpper && hasLower && hasDigit;

  const navigateView = (nextView: AuthView, routePath?: string) => {
    setView(nextView);
    setError(null);
    setNotice(null);
    setNeedsVerificationPrompt(false);
    setResetDone(false);
    if (nextView === 'login' || nextView === 'register' || nextView === 'forgot') {
      setPassword('');
      setConfirmPassword('');
      setUrlToken('');
    }
    if (routePath && window.history?.pushState) {
      window.history.pushState({}, '', routePath);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      setNeedsVerificationPrompt(false);
      const user = await adminApi.login(email.trim(), password, rememberMe);
      if (window.history?.replaceState) {
        window.history.replaceState({}, '', '/');
      }
      onLoginSuccess(user);
    } catch (err: any) {
      const msg = err.message || 'Invalid email or password.';
      setError(msg);
      if (err.status === 403 && msg.toLowerCase().includes('verify your email')) {
        setNeedsVerificationPrompt(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isPasswordStrong) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setNotice(null);
      const res = await adminApi.register(
        cleanEmail,
        password,
        confirmPassword,
        fullName.trim(),
        targetYear
      );
      setPendingEmail(res.email);
      setPassword('');
      setConfirmPassword('');
      navigateView('verify-pending', '/verify-email-pending');
      setNotice(res.message);
    } catch (err: any) {
      setError(err.message || 'Could not complete registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (targetEmail: string) => {
    const clean = targetEmail.trim().toLowerCase();
    if (!clean) {
      setError('Please enter your registered email address.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.resendVerificationEmail(clean);
      setNotice(res.message);
      setNeedsVerificationPrompt(false);
    } catch (err: any) {
      setError(err.message || 'Could not resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.forgotPassword(email.trim());
      setNotice(res.message);
    } catch (err: any) {
      setError(err.message || 'Unable to process password recovery request.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlToken) {
      setError('Missing password reset token. Please open the link from your email again.');
      return;
    }
    if (!isPasswordStrong) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, and a number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.resetPasswordWithToken(urlToken, password, confirmPassword);
      setPassword('');
      setConfirmPassword('');
      setResetDone(true);
      setNotice(res.message);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired reset token.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  };

  const renderStrengthChecklist = () => {
    if (!password) return null;
    return (
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px', fontSize: '11px' }}>
        <span style={{ color: hasMinLen ? '#059669' : '#64748B', fontWeight: 600 }}>
          {hasMinLen ? '✓' : '○'} 8+ chars
        </span>
        <span style={{ color: hasUpper ? '#059669' : '#64748B', fontWeight: 600 }}>
          {hasUpper ? '✓' : '○'} Uppercase
        </span>
        <span style={{ color: hasLower ? '#059669' : '#64748B', fontWeight: 600 }}>
          {hasLower ? '✓' : '○'} Lowercase
        </span>
        <span style={{ color: hasDigit ? '#059669' : '#64748B', fontWeight: 600 }}>
          {hasDigit ? '✓' : '○'} Number
        </span>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1E293B 0%, #090E1A 75%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
      }}>
        {/* Brand Header */}
        <div style={{
          backgroundColor: '#F8FAFC',
          padding: '26px 28px 20px',
          textAlign: 'center',
          borderBottom: '1px solid #E2E8F0',
        }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            margin: '0 auto 12px',
            boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
          }}>
            🩺
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.4px' }}>
            NEET PG Master
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0' }}>
            19 Subjects • 19,225 High-Yield Clinical MCQs
          </p>

          {(view === 'login' || view === 'register') && (
            <div style={{
              display: 'flex',
              backgroundColor: '#E2E8F0',
              borderRadius: '8px',
              padding: '3px',
              marginTop: '18px',
            }}>
              <button
                type="button"
                onClick={() => navigateView('login', '/login')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: view === 'login' ? '#FFFFFF' : 'transparent',
                  color: view === 'login' ? '#0F172A' : '#64748B',
                  boxShadow: view === 'login' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => navigateView('register', '/register')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: view === 'register' ? '#FFFFFF' : 'transparent',
                  color: view === 'register' ? '#0F172A' : '#64748B',
                  boxShadow: view === 'register' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '26px 28px' }}>
          {authConfig.google_enabled && (view === 'login' || view === 'register') && (
            <>
              <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }} />
              <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: '12px' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
                <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>
                  or continue with email
                </span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
              </div>
            </>
          )}

          {notice && view !== 'verify-pending' && view !== 'verify-result' && (
            <div role="status" style={{
              padding: '10px 14px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              color: '#166534',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              ✓ {notice}
            </div>
          )}

          {error && (
            <div role="alert" style={{
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#B91C1C',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              {needsVerificationPrompt && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleResendVerification(email)}
                  style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #B91C1C',
                    backgroundColor: '#FFFFFF',
                    color: '#B91C1C',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Sending...' : 'Resend Verification Email'}
                </button>
              )}
            </div>
          )}

          {/* 1. LOGIN VIEW */}
          {view === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label htmlFor="login-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="doctor@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="login-password" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
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
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => navigateView('forgot', '/forgot-password')}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: '#0D9488',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
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
                  opacity: loading ? 0.75 : 1,
                  boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)',
                }}
              >
                {loading ? 'Signing In...' : 'Sign In to Q-Bank'}
              </button>
            </form>
          )}

          {/* 2. REGISTRATION VIEW */}
          {view === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="reg-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Dr. Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="reg-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="reg-password" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
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
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 chars (upper, lower, number)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
                {renderStrengthChecklist()}
              </div>

              <div>
                <label htmlFor="reg-confirm-password" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Confirm Password
                </label>
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px', fontWeight: 600 }}>
                    Passwords do not match
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reg-year" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Target Exam Year
                </label>
                <select
                  id="reg-year"
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
                  opacity: loading ? 0.75 : 1,
                  boxShadow: '0 4px 6px -1px rgba(13,148,136,0.3)',
                  marginTop: '4px',
                }}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* 3. VERIFY EMAIL CONFIRMATION PAGE */}
          {view === 'verify-pending' && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '40px' }}>📧</div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                Verify Your Email Address
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                {notice || `We sent a single-use verification link to `}
                {pendingEmail && !notice && <strong>{pendingEmail}</strong>}.
                Please click the <strong>Verify Email</strong> button inside the email (valid for 24 hours) before signing in.
              </p>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleResendVerification(pendingEmail || email)}
                style={{
                  padding: '11px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#0D9488',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? 'Sending Verification Email...' : 'Resend Verification Email'}
              </button>

              <button
                type="button"
                onClick={() => navigateView('login', '/login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back to Sign In
              </button>
            </div>
          )}

          {/* 4. EMAIL VERIFICATION SUCCESS / RESULT PAGE */}
          {view === 'verify-result' && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {verifyState === 'verifying' && (
                <>
                  <div style={{ fontSize: '36px' }}>⏳</div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                    Verifying Email...
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>{verifyMessage}</p>
                </>
              )}

              {verifyState === 'success' && (
                <>
                  <div style={{ fontSize: '42px' }}>✅</div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#065F46' }}>
                    Email Verified!
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                    {verifyMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateView('login', '/login')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#0D9488',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Continue to Sign In →
                  </button>
                </>
              )}

              {verifyState === 'error' && (
                <>
                  <div style={{ fontSize: '40px' }}>❌</div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991B1B' }}>
                    Verification Link Invalid or Expired
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                    {verifyMessage}
                  </p>
                  <div style={{ textAlign: 'left', marginTop: '4px' }}>
                    <label htmlFor="resend-email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Request a new verification link
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      placeholder="yourname@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleResendVerification(email)}
                    style={{
                      padding: '11px',
                      borderRadius: '8px',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Sending...' : 'Send New Verification Email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateView('login', '/login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ← Back to Sign In
                  </button>
                </>
              )}
            </div>
          )}

          {/* 5. FORGOT PASSWORD PAGE */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                  Forgot Password
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
                  Enter your registered email address and we will send you a single-use password reset link.
                </p>
              </div>
              <div>
                <label htmlFor="forgot-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Registered Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="yourname@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
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
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? 'Sending Reset Link...' : 'Send Reset Password Link'}
              </button>
              <button
                type="button"
                onClick={() => navigateView('login', '/login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* 6. RESET PASSWORD PAGE */}
          {view === 'reset' && (
            resetDone ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '40px' }}>🔒</div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#065F46' }}>
                  Password Reset Successful
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                  Your password has been updated and all prior sessions have been signed out.
                </p>
                <button
                  type="button"
                  onClick={() => navigateView('login', '/login')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#0D9488',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Sign In With New Password →
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                    Choose a New Password
                  </h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                    Enter and confirm a strong password for your NEET PG Master account.
                  </p>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="reset-password" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      New Password
                    </label>
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '12px',
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
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 chars (upper, lower, number)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputStyle}
                  />
                  {renderStrengthChecklist()}
                </div>

                <div>
                  <label htmlFor="reset-confirm" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={inputStyle}
                  />
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
                    opacity: loading ? 0.75 : 1,
                  }}
                >
                  {loading ? 'Updating Password...' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  onClick={() => navigateView('login', '/login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ← Back to Sign In
                </button>
              </form>
            )
          )}

          {/* Security Footer */}
          <div style={{
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: '1px solid #F1F5F9',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748B',
          }}>
            🔒 Protected with Argon2id hashing & HttpOnly cookie sessions
          </div>
        </div>
      </div>
    </div>
  );
};
