import React from 'react';
import {
  BarChart3,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  ListChecks,
  SlidersHorizontal,
  Stethoscope,
  Target,
} from 'lucide-react';

export type NavSection =
  | 'subjects'
  | 'problems'
  | 'attempted'
  | 'generator'
  | 'bookmarks'
  | 'analytics'
  | 'categories';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
}) => {
  const menuItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    { id: 'subjects', label: 'Subjects & Topics', icon: <BookOpen size={18} /> },
    { id: 'problems', label: 'Question Directory', icon: <ListChecks size={18} /> },
    { id: 'attempted', label: 'Attempted Q&A', icon: <Target size={18} /> },
    { id: 'generator', label: 'Custom Test', icon: <SlidersHorizontal size={18} /> },
    { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'categories', label: 'Subject Taxonomy', icon: <FolderTree size={18} /> },
  ];

  const sidebarWidth = isCollapsed ? '72px' : '248px';

  return (
    <aside
      className="desktop-sidebar"
      aria-label="Primary navigation"
      style={{
        width: sidebarWidth,
        backgroundColor: 'var(--bg-sidebar)',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 90,
        borderRight: '1px solid #1E293B',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div style={{
        padding: isCollapsed ? '16px 12px' : '16px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: '10px',
        minHeight: '68px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            flexShrink: 0,
          }}>
            <Stethoscope size={20} />
          </div>
          {!isCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                NEET PG Master
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Medical Q-Bank
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{
        padding: '16px 10px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        overflowY: 'auto',
      }}>
        {menuItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '12px',
                width: '100%',
                padding: isCollapsed ? '10px' : '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? 'rgba(13, 148, 136, 0.22)' : 'transparent',
                border: isActive ? '1px solid rgba(13, 148, 136, 0.45)' : '1px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >
              <span style={{ display: 'flex', color: isActive ? '#2DD4BF' : '#94A3B8', flexShrink: 0 }}>
                {item.icon}
              </span>
              {!isCollapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle Footer */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {!isCollapsed && (
          <div style={{ padding: '4px 6px', fontSize: '11px', color: '#94A3B8' }}>
            19,225 Verified MCQs
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            width: '100%',
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: '#1E293B',
            color: '#CBD5E1',
            border: '1px solid #334155',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {!isCollapsed && <span>Collapse sidebar</span>}
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
};
