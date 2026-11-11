import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Keyboard, RefreshCw, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export const formatMedicalHtml = (html?: string): string => {
  if (!html) return '';
  return html.replace(/src=["'](?!(?:https?:\/\/|\/|data:))([^"']+)["']/g, 'src="/media/images/$1"');
};

export const formatDuration = (secs: number): string => {
  const safe = Math.max(0, Math.floor(secs));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
};

export interface ToastMessage {
  id: number;
  type: 'error' | 'success' | 'info';
  message: string;
  onRetry?: () => void;
}

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '380px',
        width: 'calc(100vw - 40px)',
      }}
    >
      {toasts.map((t) => {
        const isErr = t.type === 'error';
        const isSuccess = t.type === 'success';
        return (
          <div
            key={t.id}
            role="status"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${isErr ? 'var(--danger-border)' : isSuccess ? 'var(--success-border)' : 'var(--border)'}`,
              borderLeft: `4px solid ${isErr ? 'var(--danger)' : isSuccess ? 'var(--success)' : 'var(--primary)'}`,
              borderRadius: '10px',
              padding: '12px 14px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              {isErr ? (
                <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              ) : (
                <CheckCircle2 size={16} style={{ color: isSuccess ? 'var(--success)' : 'var(--primary)', flexShrink: 0 }} />
              )}
              <span style={{ lineHeight: 1.4 }}>{t.message}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {t.onRetry && (
                <button
                  type="button"
                  className="compact-tap"
                  onClick={() => {
                    onDismiss(t.id);
                    t.onRetry!();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              )}
              <button
                type="button"
                className="compact-tap"
                aria-label="Dismiss notification"
                onClick={() => onDismiss(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ImageLightbox: React.FC<{
  src: string;
  onClose: () => void;
}> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)));
      if (e.key === '-') setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clinical image viewer"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 14, 26, 0.92)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Controls Toolbar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#CBD5E1' }}>
          Clinical Reference ({Math.round(scale * 100)}%) — Drag to pan
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
            style={lightboxBtnStyle}
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
            style={lightboxBtnStyle}
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            aria-label="Reset zoom and position"
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            style={lightboxBtnStyle}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            aria-label="Close image viewer"
            onClick={onClose}
            style={{ ...lightboxBtnStyle, backgroundColor: '#DC2626', borderColor: '#DC2626' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Pan/Zoom Viewport */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          dragging.current = true;
          startPt.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        }}
        onMouseMove={(e) => {
          if (!dragging.current) return;
          setOffset({ x: e.clientX - startPt.current.x, y: e.clientY - startPt.current.y });
        }}
        onMouseUp={() => {
          dragging.current = false;
        }}
        onMouseLeave={() => {
          dragging.current = false;
        }}
        onWheel={(e) => {
          const delta = e.deltaY < 0 ? 0.15 : -0.15;
          setScale((s) => Math.min(3, Math.max(0.5, +(s + delta).toFixed(2))));
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: scale > 1 ? 'grab' : 'default',
          padding: '24px',
        }}
      >
        <img
          src={src}
          alt="Clinical Reference Fullscreen"
          draggable={false}
          style={{
            maxWidth: '90vw',
            maxHeight: '82vh',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging.current ? 'none' : 'transform 0.15s ease',
            userSelect: 'none',
            borderRadius: '8px',
          }}
        />
      </div>
    </div>
  );
};

const lightboxBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid #334155',
  backgroundColor: '#1E293B',
  color: '#FFFFFF',
  cursor: 'pointer',
};

export const ShortcutsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const rows = [
    ['1 – 4 or A – D', 'Highlight an answer option'],
    ['Enter', 'Submit highlighted option'],
    ['N or Right Arrow', 'Go to next question'],
    ['P or Left Arrow', 'Go to previous question'],
    ['B', 'Toggle bookmark on current question'],
    ['M', 'Mark / unmark question for review'],
    ['?', 'Toggle this shortcuts dialog'],
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="ui-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '420px', overflow: 'hidden' }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px' }}>
            <Keyboard size={18} style={{ color: 'var(--primary)' }} />
            <span>Keyboard Shortcuts</span>
          </div>
          <button
            type="button"
            aria-label="Close shortcuts"
            onClick={onClose}
            className="compact-tap"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map(([keys, desc]) => (
            <div key={keys} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
              <kbd style={{
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}>
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
