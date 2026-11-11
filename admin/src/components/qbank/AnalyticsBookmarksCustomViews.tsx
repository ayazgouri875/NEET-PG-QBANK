import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bookmark,
  Check,
  Clock,
  Edit3,
  Flame,
  Play,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { adminApi } from '../../api';
import type {
  BookmarkItem,
  StudentAnalytics,
  SubjectItem,
  TopicItem,
} from '../../types';
import { formatMedicalHtml } from './shared';

/* ===========================
   1. ANALYTICS VIEW (PHASE 6)
=========================== */

export interface AnalyticsViewProps {
  analytics: StudentAnalytics | null;
  loading: boolean;
  onPracticeWeakTopic: (subjectId: number, topicId: number, topicName: string) => void;
  onBrowseSubjects: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics,
  loading,
  onPracticeWeakTopic,
  onBrowseSubjects,
}) => {
  const heatmapDays = useMemo(() => {
    const map: Record<string, { count: number; correct: number; avg_time_seconds: number }> = {};
    (analytics?.daily_activity || []).forEach((d) => {
      map[d.date] = {
        count: d.count,
        correct: d.correct,
        avg_time_seconds: d.avg_time_seconds,
      };
    });

    const days: { date: string; count: number; correct: number; avgTime: number }[] = [];
    const today = new Date();
    for (let i = 89; i >= 0; i -= 1) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const iso = dt.toISOString().slice(0, 10);
      const hit = map[iso];
      days.push({
        date: iso,
        count: hit ? hit.count : 0,
        correct: hit ? hit.correct : 0,
        avgTime: hit ? hit.avg_time_seconds : 0,
      });
    }
    return days;
  }, [analytics?.daily_activity]);

  const timeTrendPoints = useMemo(() => {
    return (analytics?.daily_activity || [])
      .filter((d) => d.count > 0)
      .slice(-14);
  }, [analytics?.daily_activity]);

  if (loading && !analytics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ui-card skeleton" style={{ height: '140px' }} />
        <div className="ui-card skeleton" style={{ height: '240px' }} />
      </div>
    );
  }

  if (!analytics || analytics.total_attempted === 0) {
    return (
      <div className="ui-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <BarChart3 size={36} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          No Performance Analytics Yet
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Complete a subject drill or solve a few MCQs to unlock subject accuracy charts, weak-topic detection, and your 90-day streak heatmap.
        </p>
        <button
          type="button"
          onClick={onBrowseSubjects}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Start Practicing
        </button>
      </div>
    );
  }

  const weakTopics = analytics.weak_topics || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        <KpiCard label="Questions Attempted" value={String(analytics.total_attempted)} tone="var(--text-primary)" />
        <KpiCard
          label="Overall Accuracy"
          value={`${Math.round(analytics.overall_accuracy)}%`}
          tone={analytics.overall_accuracy >= 60 ? 'var(--success)' : 'var(--danger)'}
        />
        <KpiCard label="Correct Answers" value={String(analytics.total_correct)} tone="var(--success)" />
        <KpiCard label="Incorrect Answers" value={String(analytics.total_incorrect)} tone="var(--danger)" />
        <KpiCard
          label="Avg Time / MCQ"
          value={analytics.avg_seconds_per_question ? `${Math.round(analytics.avg_seconds_per_question)}s` : '—'}
          tone="var(--accent)"
        />
      </div>

      {/* 90-Day Daily Activity Heatmap */}
      <div className="ui-card" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              90-Day Study Activity
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Less</span>
            {[0, 0.25, 0.55, 0.85, 1].map((alpha, i) => (
              <span
                key={i}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  backgroundColor: alpha === 0 ? 'var(--bg-subtle)' : `rgba(13, 148, 136, ${alpha})`,
                  border: '1px solid var(--border)',
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(18, minmax(10px, 1fr))',
            gap: '4px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          {heatmapDays.map((day) => {
            let bg = 'var(--bg-subtle)';
            if (day.count >= 25) bg = 'rgba(13, 148, 136, 1)';
            else if (day.count >= 12) bg = 'rgba(13, 148, 136, 0.75)';
            else if (day.count >= 5) bg = 'rgba(13, 148, 136, 0.5)';
            else if (day.count >= 1) bg = 'rgba(13, 148, 136, 0.28)';

            const pct = day.count > 0 ? Math.round((day.correct / day.count) * 100) : 0;
            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} MCQs (${pct}% accuracy)`}
                style={{
                  aspectRatio: '1 / 1',
                  minHeight: '12px',
                  borderRadius: '3px',
                  backgroundColor: bg,
                  border: '1px solid var(--border)',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Subject-Wise Horizontal Bar Chart + Time-per-Question Trend */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="ui-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Activity size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Subject-Wise Accuracy
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {analytics.subject_breakdown.map((sb) => {
              const pct = Math.round(sb.accuracy);
              const barColor = pct >= 65 ? 'var(--success)' : pct >= 45 ? 'var(--primary)' : 'var(--danger)';
              return (
                <div key={sb.code || sb.subject}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sb.subject}</span>
                    <span style={{ fontWeight: 700, color: barColor }}>
                      {pct}% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({sb.correct}/{sb.attempted})</span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      borderRadius: '999px',
                      backgroundColor: 'var(--bg-subtle)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.max(2, pct))}%`,
                        backgroundColor: barColor,
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time-per-question SVG trend + Weak Topics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ui-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Avg Seconds / Question Trend
              </h3>
            </div>
            {timeTrendPoints.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                Not enough timed attempts yet.
              </p>
            ) : (
              <TimeTrendSvg points={timeTrendPoints} />
            )}
          </div>

          <div className="ui-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <TrendingUp size={18} style={{ color: 'var(--danger)' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Weak Topics (Min 5 Attempts)
              </h3>
            </div>
            {weakTopics.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                No weak topics flagged yet (topics appear once you attempt at least 5 MCQs below 60% accuracy).
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {weakTopics.map((wt) => (
                  <div
                    key={wt.topic_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {wt.topic_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {wt.subject_name} • {wt.correct}/{wt.attempted} correct (
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                          {Math.round(wt.accuracy)}%
                        </span>
                        )
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPracticeWeakTopic(wt.subject_id, wt.topic_id, wt.topic_name)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={12} /> Practice now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function KpiCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="ui-card" style={{ padding: '16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: tone }}>{value}</div>
    </div>
  );
}

function TimeTrendSvg({
  points,
}: {
  points: { date: string; count: number; avg_time_seconds: number }[];
}) {
  const maxVal = Math.max(30, ...points.map((p) => p.avg_time_seconds || 0));
  const width = 460;
  const height = 100;
  const padX = 16;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((pt, i) => {
    const x = points.length === 1 ? width / 2 : padX + (i / (points.length - 1)) * innerW;
    const y = padY + innerH - ((pt.avg_time_seconds || 0) / maxVal) * innerH;
    return { x, y, pt };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '96px', display: 'block' }}>
      {coords.length > 1 && (
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
        />
      )}
      {coords.map((c, idx) => (
        <circle key={idx} cx={c.x} cy={c.y} r="4" fill="var(--accent)" stroke="var(--bg-card)" strokeWidth="1.5">
          <title>{`${c.pt.date}: ${Math.round(c.pt.avg_time_seconds)}s avg (${c.pt.count} MCQs)`}</title>
        </circle>
      ))}
    </svg>
  );
}

/* ===========================
   2. BOOKMARKS VIEW (PHASE 6)
=========================== */

export interface BookmarksViewProps {
  subjects: SubjectItem[];
  bookmarks: BookmarkItem[];
  loading: boolean;
  onRefresh: (subjectId?: number) => Promise<void>;
  onRemoveBookmark: (questionId: number) => Promise<void>;
  onSolveQuestion: (questionId: number) => void;
  onPracticeBookmarked: (questionIds: number[]) => void;
  onBrowseDirectory: () => void;
  onNotify: (type: 'error' | 'success' | 'info', message: string, onRetry?: () => void) => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  subjects,
  bookmarks,
  loading,
  onRefresh,
  onRemoveBookmark,
  onSolveQuestion,
  onPracticeBookmarked,
  onBrowseDirectory,
  onNotify,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookmarks.filter((b) => {
      if (subjectFilter && String(b.question?.subject_id || '') !== subjectFilter) {
        return false;
      }
      if (!q) return true;
      const stem = (b.question?.html_content || b.question?.text || '').toLowerCase();
      const note = (b.notes || '').toLowerCase();
      const subj = (b.question?.subject_name || '').toLowerCase();
      return stem.includes(q) || note.includes(q) || subj.includes(q);
    });
  }, [bookmarks, subjectFilter, search]);

  const handleSaveInlineNote = async (questionId: number) => {
    if (savingNote) return;
    try {
      setSavingNote(true);
      await adminApi.saveBookmarkNote(questionId, noteDraft.trim());
      setEditingNoteId(null);
      await onRefresh(subjectFilter ? Number(subjectFilter) : undefined);
      onNotify('success', 'Bookmark note updated.');
    } catch (err: any) {
      onNotify('error', err.message || 'Could not update bookmark note');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header & Actions */}
      <div
        className="ui-card"
        style={{
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Bookmarked Revision MCQs ({filtered.length})
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Filter by subject, add high-yield revision notes, or drill all bookmarked questions together.
          </p>
        </div>

        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() => onPracticeBookmarked(filtered.map((b) => b.question_id))}
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
            <span>Practice bookmarked ({filtered.length})</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div
        className="ui-card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <select
          aria-label="Filter bookmarks by subject"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
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

        <div style={{ position: 'relative', flex: '1 1 220px' }}>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved stems or notes..."
            aria-label="Search bookmarks"
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
      </div>

      {/* Bookmark Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="ui-card skeleton" style={{ height: '100px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="ui-card" style={{ padding: '44px 24px', textAlign: 'center' }}>
          <Bookmark size={34} style={{ color: 'var(--primary)', marginBottom: '10px' }} />
          <h4 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            No bookmarked questions found
          </h4>
          <p style={{ margin: '0 0 18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Click the bookmark icon on any question row or during practice to build your revision deck.
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
            Explore Question Directory
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((b) => {
            const isEditing = editingNoteId === b.question_id;
            return (
              <div
                key={b.id}
                className="ui-card"
                style={{ padding: '16px', cursor: 'pointer' }}
                onClick={() => onSolveQuestion(b.question_id)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                    {b.question?.subject_name || 'MCQ'}
                    {b.question?.topic_name ? ` > ${b.question.topic_name}` : ''}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 500 }}>
                      Saved {new Date(b.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteId(b.question_id);
                        setNoteDraft(b.notes || '');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '7px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Edit3 size={13} />
                      <span>{b.notes ? 'Edit note' : 'Add note'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void onRemoveBookmark(b.question_id)}
                      aria-label="Remove bookmark"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        borderRadius: '7px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div
                  className="medical-html-content"
                  style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{
                    __html: formatMedicalHtml(
                      b.question?.html_content || b.question?.text || `Question #${b.question_id}`
                    ),
                  }}
                />

                {isEditing ? (
                  <div
                    style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={3}
                      placeholder="Write revision pearl..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--primary)',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '7px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingNote}
                        onClick={() => void handleSaveInlineNote(b.question_id)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '7px',
                          border: 'none',
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {savingNote ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </div>
                ) : (
                  b.notes && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--primary-soft)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <strong style={{ color: 'var(--primary)' }}>Note:</strong> {b.notes}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ===========================
   3. CUSTOM TEST GENERATOR (PHASE 6)
=========================== */

export interface CustomTestViewProps {
  subjects: SubjectItem[];
  onStartTest: (config: {
    title: string;
    subject_ids: number[];
    topic_ids: number[];
    question_count: number;
    test_mode: 'practice' | 'exam';
    difficulty?: string;
    filter_status?: string;
  }) => Promise<void>;
}

export const CustomTestView: React.FC<CustomTestViewProps> = ({ subjects, onStartTest }) => {
  const [title, setTitle] = useState('Custom NEET PG Block');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [availableTopics, setAvailableTopics] = useState<TopicItem[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [questionCount, setQuestionCount] = useState(25);
  const [difficulty, setDifficulty] = useState<string>('');
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unattempted' | 'wrong'>('all');
  const [submitting, setSubmitting] = useState(false);

  // Fetch topics whenever selected subjects change
  useEffect(() => {
    let active = true;
    const loadTopics = async () => {
      if (selectedSubjectIds.length === 0) {
        setAvailableTopics([]);
        setSelectedTopicIds([]);
        return;
      }
      try {
        setLoadingTopics(true);
        const batches = await Promise.all(
          selectedSubjectIds.slice(0, 6).map((sid) => adminApi.fetchTopics(sid).catch(() => []))
        );
        if (!active) return;
        const merged = batches.flat();
        setAvailableTopics(merged);
        const validIds = new Set(merged.map((t) => t.id));
        setSelectedTopicIds((prev) => prev.filter((id) => validIds.has(id)));
      } finally {
        if (active) setLoadingTopics(false);
      }
    };
    void loadTopics();
    return () => {
      active = false;
    };
  }, [selectedSubjectIds]);

  const toggleSubject = (id: number) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleTopic = (id: number) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      await onStartTest({
        title: title.trim() || 'Custom NEET PG Block',
        subject_ids: selectedSubjectIds,
        topic_ids: selectedTopicIds,
        question_count: questionCount,
        test_mode: mode,
        difficulty: difficulty || undefined,
        filter_status: filterStatus !== 'all' ? filterStatus : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedMinutes = questionCount;

  return (
    <form onSubmit={handleLaunch} className="ui-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Sliders size={20} style={{ color: 'var(--primary)' }} />
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Custom Test Builder
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Combine multiple subjects and topics, choose timed exam or untimed drill mode, and filter by unattempted or wrong MCQs.
          </p>
        </div>
      </div>

      {/* Title & Mode */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Session Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Session Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {(['practice', 'exam'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: `1.5px solid ${mode === m ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: mode === m ? 'var(--primary-soft)' : 'var(--bg-card)',
                  color: mode === m ? 'var(--primary)' : 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m === 'practice' ? 'Practice (Instant)' : 'Exam (Timed)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-select Subjects */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Select Subjects ({selectedSubjectIds.length === 0 ? 'All Subjects' : `${selectedSubjectIds.length} selected`})
          </label>
          {selectedSubjectIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSubjectIds([])}
              style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Reset to all
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {subjects.map((s) => {
            const active = selectedSubjectIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSubject(s.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 11px',
                  borderRadius: '999px',
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: active ? 'var(--primary)' : 'var(--bg-subtle)',
                  color: active ? '#FFFFFF' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {active && <Check size={12} />}
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dependent Topics */}
      {selectedSubjectIds.length > 0 && (
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Topics Filter ({selectedTopicIds.length === 0 ? 'All topics in selected subjects' : `${selectedTopicIds.length} topics selected`})
          </label>
          {loadingTopics ? (
            <div className="skeleton" style={{ height: '42px', borderRadius: '8px' }} />
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                maxHeight: '140px',
                overflowY: 'auto',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              {availableTopics.map((t) => {
                const active = selectedTopicIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      backgroundColor: active ? 'var(--accent)' : 'var(--bg-card)',
                      color: active ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Question Count Slider + Difficulty + Pool Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Number of MCQs
            </label>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
              {questionCount} MCQs
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            aria-label="Number of MCQs"
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>5</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Include Questions
          </label>
          <select
            aria-label="Include question pool status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'unattempted' | 'wrong')}
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          >
            <option value="all">All Questions</option>
            <option value="unattempted">Unattempted Only</option>
            <option value="wrong">Wrong Questions Only</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Difficulty
          </label>
          <select
            aria-label="Question difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          >
            <option value="">Any Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Footer: Estimated Time + Start CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Clock size={15} style={{ color: 'var(--primary)' }} />
          <span>
            Estimated time:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {mode === 'exam' ? `${estimatedMinutes} min countdown` : `~${estimatedMinutes} min (self-paced)`}
            </strong>
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          <Play size={15} />
          <span>{submitting ? 'Generating...' : 'Start Custom Test'}</span>
        </button>
      </div>
    </form>
  );
};
