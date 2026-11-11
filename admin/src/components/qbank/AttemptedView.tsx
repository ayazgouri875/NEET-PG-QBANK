import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RotateCcw,
  Search,
  Sparkles,
  StickyNote,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { adminApi } from '../../api';
import type {
  AttemptedQuestionItem,
  AttemptedTrendPoint,
  PaginatedAttemptedQuestions,
  QuestionItem,
  SubjectItem,
} from '../../types';
import { ImageLightbox, formatMedicalHtml } from './shared';

export interface AttemptedViewProps {
  subjects: SubjectItem[];
  bookmarkedMap: Record<number, boolean>;
  onToggleBookmark: (questionId: number) => Promise<void>;
  onReattemptQuestion: (questionId: number) => void;
  onReattemptAllIncorrect: () => void;
  onBrowseDirectory: () => void;
  onNotify: (type: 'error' | 'success' | 'info', message: string, onRetry?: () => void) => void;
}

const PAGE_SIZE = 20;

export const AttemptedView: React.FC<AttemptedViewProps> = ({
  subjects,
  bookmarkedMap,
  onToggleBookmark,
  onReattemptQuestion,
  onReattemptAllIncorrect,
  onBrowseDirectory,
  onNotify,
}) => {
  const [items, setItems] = useState<AttemptedQuestionItem[]>([]);
  const [stats, setStats] = useState<PaginatedAttemptedQuestions['stats'] | null>(null);
  const [trend, setTrend] = useState<AttemptedTrendPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [subjectId, setSubjectId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [expandedRowIds, setExpandedRowIds] = useState<Record<number, boolean>>({});
  const [detailCache, setDetailCache] = useState<Record<number, QuestionItem>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [noteTargetQId, setNoteTargetQId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminApi.fetchAttemptedQuestions({
        page,
        page_size: PAGE_SIZE,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
        subject_id: subjectId ? Number(subjectId) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: debouncedQuery || undefined,
      });
      setItems(res.items);
      setStats(res.stats);
      setTrend(res.trend || []);
      setTotal(res.total);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load attempted questions', () => void loadData());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, subjectId, dateFrom, dateTo, debouncedQuery]);

  const toggleExpand = async (item: AttemptedQuestionItem) => {
    const nextState = !expandedRowIds[item.id];
    setExpandedRowIds((prev) => ({ ...prev, [item.id]: nextState }));
    if (nextState && !detailCache[item.question_id]) {
      try {
        const detail = await adminApi.fetchQuestionDetail(item.question_id);
        setDetailCache((prev) => ({ ...prev, [item.question_id]: detail }));
      } catch {
        // fallback to summary item explanation
      }
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noteTargetQId === null || savingNote) return;
    try {
      setSavingNote(true);
      await adminApi.saveBookmarkNote(noteTargetQId, noteText.trim());
      onNotify('success', 'Study note saved to your bookmarks.');
      setNoteTargetQId(null);
      setNoteText('');
    } catch (err: any) {
      onNotify('error', err.message || 'Could not save study note');
    } finally {
      setSavingNote(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    statusFilter !== 'all' || subjectId !== '' || dateFrom !== '' || dateTo !== '' || debouncedQuery !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Overview */}
      <div className="ui-card" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Attempted Questions Log
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Click any attempt row to expand full options, clinical images, and explanation.
            </p>
          </div>

          {stats && stats.total_incorrect > 0 && (
            <button
              type="button"
              onClick={onReattemptAllIncorrect}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={15} />
              <span>Re-attempt all incorrect ({stats.total_incorrect})</span>
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: '12px',
            marginBottom: trend.length > 0 ? '18px' : 0,
          }}
        >
          <StatTile label="Total Attempted" value={stats ? String(stats.total_attempted) : '—'} tone="var(--text-primary)" />
          <StatTile label="Correct (+4)" value={stats ? String(stats.total_correct) : '—'} tone="var(--success)" />
          <StatTile label="Incorrect (-1)" value={stats ? String(stats.total_incorrect) : '—'} tone="var(--danger)" />
          <StatTile
            label="Accuracy"
            value={stats ? `${Math.round(stats.accuracy_percentage)}%` : '—'}
            tone={stats && stats.accuracy_percentage >= 60 ? 'var(--success)' : 'var(--primary)'}
          />
        </div>

        {trend.length > 0 && <AccuracyTrendSvg points={trend} />}
      </div>

      {/* Sticky Filter Bar */}
      <div
        className="ui-card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          position: 'sticky',
          top: '12px',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(['all', 'correct', 'incorrect'] as const).map((st) => {
            const active = statusFilter === st;
            let bg = 'var(--bg-subtle)';
            let color = 'var(--text-secondary)';
            if (active) {
              bg = st === 'correct' ? 'var(--success)' : st === 'incorrect' ? 'var(--danger)' : 'var(--primary)';
              color = '#FFFFFF';
            }
            return (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: bg,
                  color,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {st === 'all' ? 'All' : st === 'correct' ? 'Correct' : 'Incorrect'}
              </button>
            );
          })}
        </div>

        <select
          aria-label="Filter attempted questions by subject"
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            fontSize: '13px',
          }}
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
          />
        </div>

        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search attempted stems..."
            aria-label="Search attempted questions"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '7px 10px 7px 30px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSubjectId('');
              setDateFrom('');
              setDateTo('');
              setSearchInput('');
              setDebouncedQuery('');
              setPage(1);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Results List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ui-card skeleton" style={{ height: '92px' }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="ui-card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {hasFilters ? 'No attempts match these filters' : 'No attempted questions yet'}
          </h4>
          <p style={{ margin: '0 0 18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {hasFilters
              ? 'Try widening your date range or resetting the status filter.'
              : 'Solve a quick drill or open an MCQ from the directory to start tracking your accuracy.'}
          </p>
          <button
            type="button"
            onClick={onBrowseDirectory}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Browse Question Directory
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item) => {
            const expanded = Boolean(expandedRowIds[item.id]);
            const detail = detailCache[item.question_id];
            const isBookmarked = Boolean(bookmarkedMap[item.question_id]);
            const yourLetter = item.selected_option_label || '-';
            const corrLetter = item.correct_option_label || '-';
            const stemHtml = item.html_content || item.text || '';
            const explHtml =
              detail?.explanation?.html_content ||
              detail?.explanation?.text ||
              item.explanation?.html_content ||
              item.explanation?.text;

            return (
              <div
                key={item.id}
                className="ui-card"
                style={{
                  overflow: 'hidden',
                  borderLeft: `4px solid ${item.is_correct ? 'var(--success)' : 'var(--danger)'}`,
                }}
              >
                {/* Collapsed Row Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void toggleExpand(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void toggleExpand(item);
                    }
                  }}
                  aria-expanded={expanded}
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: item.is_correct ? 'var(--success-soft)' : 'var(--danger-soft)',
                          color: item.is_correct ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {item.is_correct ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {item.is_correct ? 'Correct' : 'Incorrect'}
                      </span>

                      {item.subject_name && (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {item.subject_name}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-subtle)',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.difficulty}
                      </span>

                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(item.answered_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Your:{' '}
                        <span style={{ color: item.is_correct ? 'var(--success)' : 'var(--danger)' }}>
                          {yourLetter}
                        </span>{' '}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>vs</span> Correct:{' '}
                        <span style={{ color: 'var(--success)' }}>{corrLetter}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => onReattemptQuestion(item.question_id)}
                        title="Re-attempt this question"
                        aria-label="Re-attempt question"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 9px',
                          borderRadius: '7px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Re-attempt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void onToggleBookmark(item.question_id)}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '7px',
                          border: `1px solid ${isBookmarked ? 'var(--primary)' : 'var(--border)'}`,
                          backgroundColor: isBookmarked ? 'var(--primary-soft)' : 'var(--bg-card)',
                          color: isBookmarked ? 'var(--primary)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNoteTargetQId(item.question_id);
                          setNoteText('');
                        }}
                        title="Add bookmark study note"
                        aria-label="Add study note"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 9px',
                          borderRadius: '7px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <StickyNote size={13} />
                        <span>Note</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void toggleExpand(item)}
                        aria-label={expanded ? 'Collapse details' : 'Expand details'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '30px',
                          height: '30px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {!expanded && (
                    <div
                      className="medical-html-content"
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      dangerouslySetInnerHTML={{ __html: formatMedicalHtml(stemHtml) }}
                    />
                  )}
                </div>

                {/* Expanded Detail Body */}
                {expanded && (
                  <div
                    style={{
                      padding: '14px 16px 18px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="medical-html-content"
                      style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '12px' }}
                      dangerouslySetInnerHTML={{ __html: formatMedicalHtml(stemHtml) }}
                    />

                    {detail?.images && detail.images.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                        {detail.images.map((img) => {
                          const src = `/media/images/${img.filename}`;
                          return (
                            <button
                              key={img.id}
                              type="button"
                              onClick={() => setLightboxSrc(src)}
                              style={{
                                position: 'relative',
                                padding: 0,
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                backgroundColor: 'var(--bg-subtle)',
                                cursor: 'zoom-in',
                              }}
                            >
                              <img
                                src={src}
                                alt={img.caption || 'Question figure'}
                                loading="lazy"
                                style={{ maxHeight: '300px', maxWidth: '100%', display: 'block', objectFit: 'contain' }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  right: '6px',
                                  bottom: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: 'rgba(15,23,42,0.78)',
                                  color: '#FFFFFF',
                                  fontSize: '11px',
                                  padding: '3px 7px',
                                  borderRadius: '5px',
                                }}
                              >
                                <ZoomIn size={12} /> Zoom
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* All Options if detail loaded, else Selected vs Correct */}
                    {detail?.options && detail.options.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                        {detail.options.map((opt, idx) => {
                          const optLabel = opt.option_label || String.fromCharCode(65 + idx);
                          const isCorr = opt.is_correct || optLabel === corrLetter;
                          const isYourWrong = !isCorr && optLabel === yourLetter;
                          return (
                            <div
                              key={opt.id || idx}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${
                                  isCorr ? 'var(--success)' : isYourWrong ? 'var(--danger)' : 'var(--border)'
                                }`,
                                backgroundColor: isCorr
                                  ? 'var(--success-soft)'
                                  : isYourWrong
                                    ? 'var(--danger-soft)'
                                    : 'var(--bg-subtle)',
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                              }}
                            >
                              <strong style={{ minWidth: '20px' }}>{optLabel}.</strong>
                              <span
                                style={{ flex: 1 }}
                                dangerouslySetInnerHTML={{ __html: formatMedicalHtml(opt.html_content || opt.text) }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '10px',
                          marginBottom: '14px',
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${item.is_correct ? 'var(--success)' : 'var(--danger)'}`,
                            backgroundColor: item.is_correct ? 'var(--success-soft)' : 'var(--danger-soft)',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                            Your Answer ({yourLetter})
                          </div>
                          <div>{item.selected_option_text || 'Skipped'}</div>
                        </div>
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--success)',
                            backgroundColor: 'var(--success-soft)',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>
                            Correct Answer ({corrLetter})
                          </div>
                          <div>{item.correct_option_text}</div>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          marginBottom: '6px',
                        }}
                      >
                        Explanation
                      </div>
                      <div
                        className="medical-html-content"
                        style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-primary)' }}
                        dangerouslySetInnerHTML={{
                          __html: formatMedicalHtml(explHtml || 'No explanation available.'),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} attempts
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {noteTargetQId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <form
            onSubmit={handleSaveNote}
            className="ui-card"
            style={{ width: '100%', maxWidth: '420px', padding: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Save Study Note (MCQ #{noteTargetQId})
              </h4>
              <button
                type="button"
                onClick={() => setNoteTargetQId(null)}
                aria-label="Close note dialog"
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="Write high-yield pearl, mnemonic, or mistake reason..."
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                marginBottom: '14px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setNoteTargetQId(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingNote}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
};

function StatTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: tone }}>{value}</div>
    </div>
  );
}

function AccuracyTrendSvg({ points }: { points: AttemptedTrendPoint[] }) {
  const chartData = useMemo(() => points.slice(-14), [points]);
  if (chartData.length === 0) return null;

  const width = 640;
  const height = 110;
  const padX = 20;
  const padY = 14;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = chartData.map((pt, idx) => {
    const x = chartData.length === 1 ? width / 2 : padX + (idx / (chartData.length - 1)) * innerW;
    const y = padY + innerH - (Math.min(100, Math.max(0, pt.accuracy)) / 100) * innerH;
    return { x, y, pt };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Accuracy Trend (Last {chartData.length} Active Days)
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0% - 100%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '96px', display: 'block' }}>
        <line x1={padX} y1={padY + innerH / 2} x2={width - padX} y2={padY + innerH / 2} stroke="var(--border)" strokeDasharray="4 4" />
        {coords.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}
        {coords.map((c, idx) => (
          <circle key={idx} cx={c.x} cy={c.y} r="4" fill="var(--primary)" stroke="var(--bg-card)" strokeWidth="1.5">
            <title>{`${c.pt.date}: ${Math.round(c.pt.accuracy)}% (${c.pt.correct}/${c.pt.attempted})`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
