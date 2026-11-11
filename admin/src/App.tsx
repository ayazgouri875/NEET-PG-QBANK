import React, { useEffect, useState } from 'react';
import { BarChart3, Bookmark, BookOpen, ListChecks, Stethoscope, User as UserIcon } from 'lucide-react';
import { adminApi } from './api';
import { AccountModal } from './components/AccountModal';
import { Header } from './components/Header';
import { NavSection, Sidebar } from './components/Sidebar';
import { CategorizationManager } from './pages/CategorizationManager';
import { LoginPage } from './pages/LoginPage';
import { StudentPractice } from './pages/StudentPractice';
import { UserItem } from './types';

const getInitialTheme = (): 'light' | 'dark' => {
  const saved = localStorage.getItem('theme_mode');
  if (saved === 'light' || saved === 'dark') return saved;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserItem | null>(() => adminApi.getUser());
  const [activeSection, setActiveSection] = useState<NavSection>('subjects');
  const [authChecking, setAuthChecking] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme_mode', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const isAuthTokenRoute = (() => {
    const path = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    return (path.includes('verify-email') || path.includes('reset-password')) && params.has('token');
  })();

  useEffect(() => {
    adminApi.setOnUnauthorized(() => {
      setCurrentUser(null);
      setShowAccountModal(false);
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
    setCurrentUser(null);
    await adminApi.logout();
  };

  if (authChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-primary)',
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'var(--primary-soft)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Stethoscope size={24} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>NEET PG Master</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Preparing your study workspace...</div>
        </div>
      </div>
    );
  }

  if (isAuthTokenRoute || !currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const getPageMeta = (section: NavSection) => {
    switch (section) {
      case 'subjects':
        return {
          title: 'Subjects & Curriculum',
          subtitle: '19 NEET PG subjects grouped by Pre-Clinical, Para-Clinical, and Clinical phases',
        };
      case 'problems':
        return {
          title: 'Question Directory',
          subtitle: 'Browse and filter all 19,225 verified high-yield MCQs',
        };
      case 'attempted':
        return {
          title: 'Attempted Questions & Answers',
          subtitle: 'Review solved items, mistakes, and detailed textbook explanations',
        };
      case 'generator':
        return {
          title: 'Custom Test Builder',
          subtitle: 'Generate practice drills or timed exams across any subject mix',
        };
      case 'bookmarks':
        return {
          title: 'Saved Bookmarks',
          subtitle: 'Quick revision queue of your starred MCQs and notes',
        };
      case 'analytics':
        return {
          title: 'Performance Analytics',
          subtitle: 'Accuracy breakdown, study consistency, and weak-area insights',
        };
      case 'categories':
        return {
          title: 'Subject Taxonomy',
          subtitle: 'Curriculum structure across 19 subjects, 283 topics, and 897 subtopics',
        };
    }
  };

  const { title, subtitle } = getPageMeta(activeSection);
  const sidebarMargin = isSidebarCollapsed ? '72px' : '248px';

  const mobileNavItems: { id: 'subjects' | 'problems' | 'bookmarks' | 'analytics' | 'profile'; label: string; icon: React.ReactNode }[] = [
    { id: 'subjects', label: 'Subjects', icon: <BookOpen size={20} /> },
    { id: 'problems', label: 'Practice', icon: <ListChecks size={20} /> },
    { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark size={20} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
    { id: 'profile', label: 'Profile', icon: <UserIcon size={20} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)', width: '100%' }}>
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <div
        className="app-main-layout"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          width: '100%',
          marginLeft: sidebarMargin,
          minHeight: '100vh',
          transition: 'margin-left 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Header
          title={title}
          subtitle={subtitle}
          user={currentUser}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          onOpenAccount={() => setShowAccountModal(true)}
        />

        <main style={{ flex: 1, paddingBottom: '24px' }}>
          {activeSection === 'categories' ? (
            <CategorizationManager />
          ) : (
            <StudentPractice
              externalSection={activeSection}
              onSectionChange={(sec) => setActiveSection(sec)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (<768px): Subjects, Practice, Bookmarks, Analytics, Profile */}
      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          display: 'none',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '64px',
          zIndex: 80,
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.08)',
        }}
      >
        {mobileNavItems.map((item) => {
          const isActive =
            item.id === 'profile'
              ? showAccountModal
              : activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'profile') {
                  setShowAccountModal(true);
                } else {
                  setShowAccountModal(false);
                  setActiveSection(item.id);
                }
              }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: '44px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                gap: '4px',
                padding: '6px 0',
              }}
            >
              {item.icon}
              <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

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
    </div>
  );
};

export default App;
