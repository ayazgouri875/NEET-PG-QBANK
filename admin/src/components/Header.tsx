import React from 'react';
import { UserItem } from '../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  user: UserItem | null;
  onLogout: () => void;
  onOpenAccount?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  user,
  onLogout,
  onOpenAccount,
  onToggleMobileMenu,
}) => {
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'DR';
  };

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 20px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Left: Mobile Menu Toggle & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="show-on-mobile-tablet"
            title="Open Navigation Menu"
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#0F172A',
              fontSize: '18px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ☰
          </button>
        )}

        <div style={{ minWidth: 0 }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#0F172A',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </h2>
          {subtitle && (
            <p className="hide-on-mobile" style={{
              fontSize: '12px',
              color: '#64748B',
              margin: '2px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: User Profile & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {user && (
          <button
            type="button"
            onClick={onOpenAccount}
            title="Account & Security Settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: '1px solid transparent',
              borderRadius: '10px',
              padding: '4px 8px',
              cursor: onOpenAccount ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (onOpenAccount) {
                e.currentTarget.style.backgroundColor = '#F8FAFC';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            {/* User Avatar */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#EFF6FF',
              border: '2px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#1E40AF',
              fontSize: '12px',
              boxShadow: '0 1px 3px rgba(37,99,235,0.1)',
            }}>
              {getInitials(user.full_name, user.email)}
            </div>

            {/* User Meta (hidden on small phones to conserve space) */}
            <div className="hide-on-mobile" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                {user.full_name || 'Medical Doctor'} ▾
              </span>
              <span style={{ fontSize: '10px', color: '#64748B', lineHeight: 1.2 }}>
                {user.email}
              </span>
            </div>
          </button>
        )}

        {/* Log Out Button */}
        <button
          onClick={onLogout}
          title="Sign out of NEET PG Q-Bank"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            color: '#DC2626',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#FEF2F2';
            e.currentTarget.style.borderColor = '#FCA5A5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F8FAFC';
            e.currentTarget.style.borderColor = '#E2E8F0';
          }}
        >
          <span>🚪</span>
          <span className="hide-on-mobile">Log Out</span>
        </button>
      </div>
    </header>
  );
};
