import React, { useEffect, useState } from 'react';
import { adminApi } from './api';
import { AccountModal } from './components/AccountModal';
import { Header } from './components/Header';
import { NavTab, Sidebar } from './components/Sidebar';
import { CategorizationManager } from './pages/CategorizationManager';
import { LoginPage } from './pages/LoginPage';
import { StudentPractice } from './pages/StudentPractice';
import { UserItem } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserItem | null>(() => adminApi.getUser());
  const [currentTab, setCurrentTab] = useState<NavTab>('student');
  const [authChecking, setAuthChecking] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const isAuthTokenRoute = (() => {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    return (path.includes('verify-email') || path.includes('reset-password')) && params.has('token');
  })();

  useEffect(() => {
    adminApi.setOnUnauthorized(() => {
      setCurrentUser(null);
      setShowAccountModal(false);
      setIsMobileMenuOpen(false);
    });

    if (isAuthTokenRoute) {
      setAuthChecking(false);
      return () => adminApi.setOnUnauthorized(null);
    }

    adminApi.fetchProfile()
      .then((user) => {
        setCurrentUser(user);
      })
      .catch(() => {
        adminApi.clearLocalSession();
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });

    return () => {
      adminApi.setOnUnauthorized(null);
    };
  }, [isAuthTokenRoute]);

  const handleLogout = async () => {
    setShowAccountModal(false);
    setIsMobileMenuOpen(false);
    setCurrentUser(null);
    await adminApi.logout();
  };

  if (authChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: '16px',
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '14px' }}>🩺</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>NEET PG Question Bank</div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>Preparing your medical workspace...</div>
        </div>
      </div>
    );
  }

  // Render auth portal for unauthenticated users or email verification / password reset deep links
  if (isAuthTokenRoute || !currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const getPageTitle = (tab: NavTab) => {
    switch (tab) {
      case 'student':
        return {
          title: 'NEET PG Student Question Bank',
          subtitle: 'Interactive practice drills, custom tests, clinical explanations & performance analytics',
        };
      case 'categories':
        return {
          title: 'Curriculum & Taxonomy',
          subtitle: '19 NEET PG subjects, topics, and subtopics management',
        };
    }
  };

  const { title, subtitle } = getPageTitle(currentTab);

  const bottomNavItems: { id: NavTab; label: string; icon: string }[] = [
    { id: 'student', label: 'Q-Bank', icon: '🩺' },
    { id: 'categories', label: 'Subjects', icon: '🗂️' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', width: '100%' }}>
      {/* Responsive Sidebar (Desktop Fixed + Mobile Off-Canvas Drawer) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onLogout={handleLogout}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className="app-main-layout"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          width: '100%',
          marginLeft: '260px',
          minHeight: '100vh',
          transition: 'margin-left 0.28s ease',
        }}
      >
        <Header
          title={title}
          subtitle={subtitle}
          user={currentUser}
          onLogout={handleLogout}
          onOpenAccount={() => setShowAccountModal(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        <main style={{ flex: 1, paddingBottom: '60px' }}>
          {currentTab === 'student' && <StudentPractice />}
          {currentTab === 'categories' && <CategorizationManager />}
        </main>
      </div>

      {showAccountModal && (
        <AccountModal
          user={currentUser}
          onClose={() => setShowAccountModal(false)}
          onUserUpdated={(updated) => setCurrentUser(updated)}
          onLoggedOutAll={() => {
            setShowAccountModal(false);
            setCurrentUser(null);
          }}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Phones < 768px) */}
      <nav
        className="show-on-mobile-tablet"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '60px',
          zIndex: 80,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        }}
      >
        {bottomNavItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? '#2563EB' : '#64748B',
                gap: '2px',
                padding: '4px 0',
                transition: 'color 0.15s ease',
              }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.2px',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default App;
