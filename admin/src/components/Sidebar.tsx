import React from 'react';

export type NavTab = 'student' | 'categories';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const menuItems: { id: NavTab; label: string; icon: string; badge?: string }[] = [
    { id: 'student', label: 'Student Q-Bank', icon: '🩺', badge: 'Active' },
    { id: 'categories', label: 'Subject Taxonomy', icon: '🗂️' },
  ];

  const handleItemClick = (tab: NavTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 90,
            transition: 'opacity 0.25s ease',
          }}
        />
      )}

      {/* Sidebar Container - Fixed & Smooth */}
      <aside
        style={{
          width: '260px',
          background: 'linear-gradient(180deg, #090E1A 0%, #0F172A 60%, #0B132B 100%)',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          flexShrink: 0,
          borderRight: '1px solid #1E293B',
          zIndex: 100,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
          overflow: 'hidden',
          boxShadow: '2px 0 12px rgba(0, 0, 0, 0.15)',
        }}
        className={`sidebar-root ${isOpenMobile ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div style={{
          padding: '20px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '19px',
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.35)',
            }}>
              🩺
            </div>
            <div>
              <h1 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                NEET PG Master
              </h1>
              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500 }}>
                Medical Q-Bank Platform
              </span>
            </div>
          </div>

          {/* Close Button on Mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="show-on-mobile-tablet"
              aria-label="Close navigation"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{
          padding: '16px 12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#334155 transparent',
        }}>
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="sidebar-nav-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFFFFF' : '#94A3B8',
                  backgroundColor: isActive ? '#1E293B' : 'transparent',
                  border: isActive ? '1px solid #334155' : '1px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: '#0D9488',
                    color: '#FFFFFF',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info & Logout */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #1E293B',
          fontSize: '12px',
          color: '#64748B',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>NEET PG Curriculum</span>
            <span style={{ color: '#10B981', fontWeight: 700 }}>● Active</span>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>19,225 Verified Medical MCQs</p>

          {onLogout && (
            <button
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                onLogout();
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                marginTop: '12px',
                borderRadius: '6px',
                backgroundColor: '#1E293B',
                color: '#F87171',
                border: '1px solid #334155',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.15s ease',
              }}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      <style>{`
        .sidebar-nav-btn:hover {
          background-color: #1E293B !important;
          color: #F8FAFC !important;
        }
        .sidebar-nav-btn:active {
          transform: scale(0.98);
        }
        @media (max-width: 1024px) {
          .sidebar-root {
            width: 280px !important;
            position: fixed !important;
            top: 0 !important;
            bottom: 0 !important;
            left: 0 !important;
            transform: translateX(-100%) !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          .sidebar-root.mobile-open {
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </>
  );
};
