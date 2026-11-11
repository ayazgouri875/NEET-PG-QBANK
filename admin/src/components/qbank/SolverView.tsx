import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trophy,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { adminApi } from '../../api';
import type { QuestionItem, SubmitAnswerResult, TestSession } from '../../types';
import {
  ImageLightbox,
  ShortcutsModal,
  formatDuration,
  formatMedicalHtml,
} from './shared';

export interface SolverAnswerEntry {
  selectedIndex: number | null;
  result?: SubmitAnswerResult;
  timeSpentSeconds?: number;
}

export interface SolverViewProps {
  session: TestSession;
  bookmarkedMap: Record<number, boolean>;
  onToggleBookmark: (questionId: number) => Promise<void>;
  onSessionUpdated: (session: TestSession) => void;
  onFinishSession: (completedSession: TestSession) => void;
  onExit: () => void;
  onNotify: (type: 'error' | 'success' | 'info', message: string, onRetry?: () => void) => void;
}

const SOLVER_STORAGE_KEY = 'neetpg_active_solver_v1';

interface PersistedSolverState {
  sessionId: number;
  currentQIndex: number;
  elapsedSeconds: number;
  isTimerRunning: boolean;
  pendingSelections: Record<number, number>;
  skippedIds: number[];
  markedIds: number[];
  perQuestionSeconds: Record<number, number>;
}

function readPersistedState(sessionId: number): PersistedSolverState | null {
  try {
    const raw = sessionStorage.getItem(SOLVER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSolverState;
    if (parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedSolverState() {
  try {
    sessionStorage.removeItem(SOLVER_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export const SolverView: React.FC<SolverViewProps> = ({
  session,
  bookmarkedMap,
  onToggleBookmark,
  onSessionUpdated,
  onFinishSession,
  onExit,
  onNotify,
}) => {
  const questions = session.questions || [];
  const isExamMode = session.test_mode === 'exam';
  const examTotalSeconds = useMemo(
    () => (session.duration_minutes || session.total_questions || questions.length || 15) * 60,
    [session.duration_minutes, session.total_questions, questions.length]
  );

  const persisted = useMemo(() => readPersistedState(session.id), [session.id]);

  const [currentQIndex, setCurrentQIndex] = useState<number>(() => {
    if (persisted && persisted.currentQIndex < questions.length) {
      return persisted.currentQIndex;
    }
    return 0;
  });

  const [answers, setAnswers] = useState<Record<number, SolverAnswerEntry>>(() => {
    const map: Record<number, SolverAnswerEntry> = {};
    (session.responses || []).forEach((resp) => {
      const q = questions.find((item) => item.id === resp.question_id);
      if (resp.selected_option_index !== null && resp.selected_option_index !== undefined) {
        const correctOptIdx = q?.options?.findIndex((o) => o.is_correct) ?? -1;
        map[resp.question_id] = {
          selectedIndex: resp.selected_option_index,
          timeSpentSeconds: resp.time_spent_seconds || 0,
          result:
            !isExamMode && q && correctOptIdx >= 0
              ? {
                  question_id: resp.question_id,
                  selected_option_index: resp.selected_option_index,
                  is_correct: resp.is_correct ?? resp.selected_option_index === correctOptIdx,
                  correct_option_index: correctOptIdx,
                  explanation: q.explanation?.html_content || q.explanation?.text || '',
                  references: q.explanation?.references,
                }
              : undefined,
        };
      }
    });
    return map;
  });

  const [pendingSelections, setPendingSelections] = useState<Record<number, number>>(
    () => persisted?.pendingSelections || {}
  );
  const [markedSet, setMarkedSet] = useState<Set<number>>(() => {
    const s = new Set<number>(session.marked_question_ids || []);
    (persisted?.markedIds || []).forEach((id) => s.add(id));
    return s;
  });
  const [skippedSet, setSkippedSet] = useState<Set<number>>(() => {
    const s = new Set<number>(persisted?.skippedIds || []);
    (session.responses || []).forEach((r) => {
      if (r.selected_option_index === null) s.add(r.question_id);
    });
    return s;
  });

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    () => persisted?.elapsedSeconds ?? session.total_time_seconds ?? 0
  );
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(() =>
    persisted ? persisted.isTimerRunning : isExamMode
  );
  const [perQuestionSeconds, setPerQuestionSeconds] = useState<Record<number, number>>(
    () => persisted?.perQuestionSeconds || {}
  );

  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Wrong Answer Key');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const autoFinishedRef = useRef(false);
  const currentQ: QuestionItem | undefined = questions[currentQIndex];

  useEffect(() => {
    if (!isTimerRunning || session.status !== 'in_progress') return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      if (currentQ) {
        setPerQuestionSeconds((prev) => ({
          ...prev,
          [currentQ.id]: (prev[currentQ.id] || 0) + 1,
        }));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning, session.status, currentQ]);

  const remainingSeconds = Math.max(0, examTotalSeconds - elapsedSeconds);
  useEffect(() => {
    if (
      isExamMode &&
      session.id > 0 &&
      session.status === 'in_progress' &&
      remainingSeconds === 0 &&
      !autoFinishedRef.current
    ) {
      autoFinishedRef.current = true;
      void handleConfirmFinish(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, isExamMode]);

  useEffect(() => {
    if (session.status !== 'in_progress') return;
    try {
      const payload: PersistedSolverState = {
        sessionId: session.id,
        currentQIndex,
        elapsedSeconds,
        isTimerRunning,
        pendingSelections,
        skippedIds: Array.from(skippedSet),
        markedIds: Array.from(markedSet),
        perQuestionSeconds,
      };
      sessionStorage.setItem(SOLVER_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [
    session.id,
    session.status,
    currentQIndex,
    elapsedSeconds,
    isTimerRunning,
    pendingSelections,
    skippedSet,
    markedSet,
    perQuestionSeconds,
  ]);

  const handleHighlightOption = (optionIndex: number) => {
    if (!currentQ) return;
    if (!isExamMode && answers[currentQ.id]?.selectedIndex !== undefined) return;
    setPendingSelections((prev) => ({ ...prev, [currentQ.id]: optionIndex }));
  };

  const handleSubmitCurrent = async () => {
    if (!currentQ || submitting) return;
    const chosenIndex = pendingSelections[currentQ.id];
    if (chosenIndex === undefined) {
      onNotify('info', 'Select an option (A-D) first before submitting.');
      return;
    }

    const qTime = Math.max(1, perQuestionSeconds[currentQ.id] || 10);

    try {
      setSubmitting(true);
      let result: SubmitAnswerResult;
      if (session.id === 0) {
        result = await adminApi.solveQuestionDirectly(currentQ.id, chosenIndex, qTime);
      } else {
        result = await adminApi.submitAnswer(session.id, currentQ.id, chosenIndex, qTime);
      }

      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: {
          selectedIndex: chosenIndex,
          result,
          timeSpentSeconds: qTime,
        },
      }));
      setSkippedSet((prev) => {
        if (!prev.has(currentQ.id)) return prev;
        const next = new Set(prev);
        next.delete(currentQ.id);
        return next;
      });
      onSessionUpdated(session);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to submit answer', () => void handleSubmitCurrent());
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipCurrent = async () => {
    if (!currentQ) return;
    if (session.id > 0 && answers[currentQ.id]?.selectedIndex === undefined) {
      try {
        await adminApi.submitAnswer(
          session.id,
          currentQ.id,
          null,
          perQuestionSeconds[currentQ.id] || 0
        );
      } catch {
        // non-blocking
      }
    }
    setSkippedSet((prev) => new Set(prev).add(currentQ.id));
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((i) => i + 1);
    }
  };

  const handleToggleMark = async () => {
    if (!currentQ) return;
    const nextMarked = new Set(markedSet);
    if (nextMarked.has(currentQ.id)) {
      nextMarked.delete(currentQ.id);
    } else {
      nextMarked.add(currentQ.id);
    }
    setMarkedSet(nextMarked);
    if (session.id > 0) {
      try {
        await adminApi.toggleMarkForReview(session.id, currentQ.id);
      } catch {
        // keep optimistic state
      }
    }
  };

  const handleConfirmFinish = async (isAutoTimeUp = false) => {
    if (finishing) return;
    if (session.id === 0) {
      clearPersistedSolverState();
      onExit();
      return;
    }

    try {
      setFinishing(true);
      setConfirmFinishOpen(false);
      if (isExamMode) {
        const pendingEntries = Object.entries(pendingSelections).filter(([qIdStr]) => {
          const qId = Number(qIdStr);
          return answers[qId]?.selectedIndex === undefined;
        });
        for (const [qIdStr, optIdx] of pendingEntries) {
          const qId = Number(qIdStr);
          await adminApi.submitAnswer(session.id, qId, optIdx, perQuestionSeconds[qId] || 5);
        }
      }

      const completed = await adminApi.completeTest(session.id);
      clearPersistedSolverState();
      if (isAutoTimeUp) {
        onNotify('info', 'Exam timer ended. Your test has been submitted automatically.');
      }
      onFinishSession(completed);
    } catch (err: any) {
      onNotify('error', err.message || 'Could not finalize session', () =>
        void handleConfirmFinish(isAutoTimeUp)
      );
    } finally {
      setFinishing(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQ || reportSubmitting) return;
    try {
      setReportSubmitting(true);
      await adminApi.reportQuestion(currentQ.id, reportReason, reportDetails.trim() || undefined);
      setReportOpen(false);
      setReportDetails('');
      onNotify('success', 'Thank you. Question report submitted for review.');
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to submit question report');
    } finally {
      setReportSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (lightboxSrc || reportOpen || confirmFinishOpen) {
        if (e.key === 'Escape') {
          setLightboxSrc(null);
          setReportOpen(false);
          setConfirmFinishOpen(false);
          setShortcutsOpen(false);
        }
        return;
      }
      if (shortcutsOpen) {
        if (e.key === 'Escape' || e.key === '?') setShortcutsOpen(false);
        return;
      }
      if (!currentQ) return;

      const key = e.key.toLowerCase();
      if (key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (['1', '2', '3', '4'].includes(key)) {
        const idx = Number(key) - 1;
        if (idx < currentQ.options.length) {
          e.preventDefault();
          handleHighlightOption(idx);
        }
      } else if (['a', 'b', 'c', 'd'].includes(key)) {
        const idx = key.charCodeAt(0) - 97;
        if (idx < currentQ.options.length) {
          e.preventDefault();
          handleHighlightOption(idx);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const alreadySubmitted = answers[currentQ.id]?.selectedIndex !== undefined;
        if (!alreadySubmitted && pendingSelections[currentQ.id] !== undefined) {
          void handleSubmitCurrent();
        } else if (alreadySubmitted && currentQIndex < questions.length - 1) {
          setCurrentQIndex((i) => i + 1);
        }
      } else if (key === 'n' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentQIndex < questions.length - 1) setCurrentQIndex((i) => i + 1);
      } else if (key === 'p' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentQIndex > 0) setCurrentQIndex((i) => i - 1);
      } else if (key === 'b') {
        e.preventDefault();
        void onToggleBookmark(currentQ.id);
      } else if (key === 'm') {
        e.preventDefault();
        void handleToggleMark();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!currentQ) {
    return (
      <div className="ui-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          No questions found in this session.
        </p>
        <button
          type="button"
          onClick={onExit}
          style={{
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Return to Subjects
        </button>
      </div>
    );
  }

  const submittedEntry = answers[currentQ.id];
  const isSubmitted = submittedEntry !== undefined && submittedEntry.selectedIndex !== null;
  const highlightedIndex = isSubmitted
    ? submittedEntry.selectedIndex
    : pendingSelections[currentQ.id];

  const isBookmarked =
    bookmarkedMap[currentQ.id] !== undefined
      ? bookmarkedMap[currentQ.id]
      : Boolean(currentQ.user_status?.is_bookmarked);
  const isMarked = markedSet.has(currentQ.id);

  const answeredCount = Object.values(answers).filter((a) => a.selectedIndex !== null).length;
  const progressPct = Math.round((answeredCount / Math.max(1, questions.length)) * 100);

  return (
    <div>
      {/* Top Bar */}
      <div className="ui-card" style={{ overflow: 'hidden', marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit session"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={15} />
              <span>Exit</span>
            </button>

            <span
              style={{
                backgroundColor: isExamMode ? 'var(--accent)' : 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {isExamMode ? 'Timed Exam' : 'Practice Drill'}
            </span>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '380px',
                }}
              >
                {currentQ.subject_name || session.title}
                {currentQ.topic_name ? ` / ${currentQ.topic_name}` : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Question {currentQIndex + 1} of {questions.length} • {answeredCount} answered
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {isExamMode ? (
              <div
                aria-label="Exam countdown timer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: remainingSeconds < 120 ? 'var(--danger-soft)' : 'var(--bg-subtle)',
                  border: `1px solid ${remainingSeconds < 120 ? 'var(--danger)' : 'var(--border)'}`,
                  color: remainingSeconds < 120 ? 'var(--danger)' : 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                <Clock size={15} />
                <span>{formatDuration(remainingSeconds)}</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <Clock size={14} style={{ color: isTimerRunning ? 'var(--primary)' : 'var(--text-muted)' }} />
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    minWidth: '48px',
                  }}
                >
                  {formatDuration(elapsedSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTimerRunning((v) => !v)}
                  aria-label={isTimerRunning ? 'Pause timer' : 'Start timer'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: isTimerRunning ? 'var(--bg-card)' : 'var(--primary)',
                    color: isTimerRunning ? 'var(--text-primary)' : '#FFFFFF',
                  }}
                >
                  {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
                  <span>{isTimerRunning ? 'Pause' : 'Start'}</span>
                </button>
                {elapsedSeconds > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setElapsedSeconds(0);
                    }}
                    aria-label="Reset timer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      padding: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts help"
              title="Keyboard shortcuts (?)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <HelpCircle size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (session.id === 0) {
                  onExit();
                } else {
                  setConfirmFinishOpen(true);
                }
              }}
              disabled={finishing}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {session.id === 0 ? 'Done' : finishing ? 'Submitting...' : 'Finish & Score'}
            </button>
          </div>
        </div>

        <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--bg-subtle)' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              backgroundColor: 'var(--primary)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="solver-grid">
        <div style={{ minWidth: 0 }}>
          <div className="ui-card" style={{ padding: '24px' }}>
            {/* Question Metadata & Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                  }}
                >
                  Q{currentQIndex + 1}
                </span>
                {currentQ.difficulty && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      textTransform: 'capitalize',
                    }}
                  >
                    {currentQ.difficulty}
                  </span>
                )}
                {currentQ.pyq_year && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      backgroundColor: 'var(--accent-soft)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    PYQ {currentQ.pyq_year}
                  </span>
                )}
                {isMarked && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      backgroundColor: 'var(--accent-soft)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    <Flag size={12} /> Marked for Review
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => void handleToggleMark()}
                  aria-label="Mark question for review"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${isMarked ? 'var(--accent)' : 'var(--border)'}`,
                    backgroundColor: isMarked ? 'var(--accent-soft)' : 'var(--bg-card)',
                    color: isMarked ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Flag size={14} />
                  <span>{isMarked ? 'Marked' : 'Mark'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void onToggleBookmark(currentQ.id)}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${isBookmarked ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: isBookmarked ? 'var(--primary-soft)' : 'var(--bg-card)',
                    color: isBookmarked ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
                  <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  aria-label="Report an error in this question"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <AlertTriangle size={14} />
                  <span>Report error</span>
                </button>
              </div>
            </div>

            {/* Question Stem */}
            <div
              className="medical-html-content"
              style={{
                fontSize: '16px',
                lineHeight: 1.65,
                color: 'var(--text-primary)',
                marginBottom: '20px',
                fontWeight: 500,
              }}
              dangerouslySetInnerHTML={{
                __html: formatMedicalHtml(currentQ.html_content || currentQ.text),
              }}
            />

            {/* Clinical Images */}
            {currentQ.images && currentQ.images.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                {currentQ.images.map((img) => {
                  const imgSrc = `/media/images/${img.filename}`;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setLightboxSrc(imgSrc)}
                      aria-label="Open question image in full-screen zoom viewer"
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        padding: 0,
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        backgroundColor: 'var(--bg-subtle)',
                        cursor: 'zoom-in',
                        maxWidth: '100%',
                      }}
                    >
                      <img
                        src={imgSrc}
                        alt={img.caption || 'Clinical question figure'}
                        loading="lazy"
                        style={{
                          display: 'block',
                          maxHeight: '320px',
                          maxWidth: '100%',
                          objectFit: 'contain',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: '8px',
                          bottom: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'rgba(15, 23, 42, 0.78)',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        <ZoomIn size={13} /> Click to zoom
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentQ.options.map((opt, idx) => {
                const letter = opt.option_label || String.fromCharCode(65 + idx);
                const showPracticeFeedback = !isExamMode && isSubmitted && submittedEntry?.result;
                const correctIdx = submittedEntry?.result?.correct_option_index;
                const isThisSelected = highlightedIndex === idx;
                const isThisCorrect = showPracticeFeedback && idx === correctIdx;
                const isThisWrong =
                  showPracticeFeedback &&
                  idx === submittedEntry.selectedIndex &&
                  idx !== correctIdx;

                let borderColor = 'var(--border)';
                let bgColor = 'var(--bg-card)';
                let badgeBg = 'var(--bg-subtle)';
                let badgeColor = 'var(--text-secondary)';

                if (isThisCorrect) {
                  borderColor = 'var(--success)';
                  bgColor = 'var(--success-soft)';
                  badgeBg = 'var(--success)';
                  badgeColor = '#FFFFFF';
                } else if (isThisWrong) {
                  borderColor = 'var(--danger)';
                  bgColor = 'var(--danger-soft)';
                  badgeBg = 'var(--danger)';
                  badgeColor = '#FFFFFF';
                } else if (isThisSelected) {
                  borderColor = 'var(--primary)';
                  bgColor = 'var(--primary-soft)';
                  badgeBg = 'var(--primary)';
                  badgeColor = '#FFFFFF';
                }

                return (
                  <button
                    key={opt.id || idx}
                    type="button"
                    onClick={() => handleHighlightOption(idx)}
                    disabled={!isExamMode && isSubmitted}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: '10px',
                      border: `1.5px solid ${borderColor}`,
                      backgroundColor: bgColor,
                      color: 'var(--text-primary)',
                      cursor: !isExamMode && isSubmitted ? 'default' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        backgroundColor: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {letter}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: '15px',
                        lineHeight: 1.5,
                        paddingTop: '2px',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: formatMedicalHtml(opt.html_content || opt.text),
                      }}
                    />
                    {isThisCorrect && (
                      <CheckCircle2 size={20} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '3px' }} />
                    )}
                    {isThisWrong && (
                      <XCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '3px' }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                  disabled={currentQIndex === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-card)',
                    color: currentQIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                <button
                  type="button"
                  onClick={() => void handleSkipCurrent()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <SkipForward size={15} /> Skip
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(!isSubmitted || isExamMode) && (
                  <button
                    type="button"
                    onClick={() => void handleSubmitCurrent()}
                    disabled={submitting || pendingSelections[currentQ.id] === undefined}
                    style={{
                      backgroundColor:
                        pendingSelections[currentQ.id] !== undefined
                          ? 'var(--primary)'
                          : 'var(--bg-subtle)',
                      color:
                        pendingSelections[currentQ.id] !== undefined
                          ? '#FFFFFF'
                          : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '9px 20px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor:
                        pendingSelections[currentQ.id] !== undefined && !submitting
                          ? 'pointer'
                          : 'not-allowed',
                    }}
                  >
                    {submitting
                      ? 'Saving...'
                      : isExamMode && isSubmitted
                        ? 'Update Answer'
                        : 'Submit Answer'}
                  </button>
                )}

                {currentQIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((i) => Math.min(questions.length - 1, i + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
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
                    Next <ChevronRight size={16} />
                  </button>
                ) : (
                  session.id > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmFinishOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'var(--accent)',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Finish Session <ArrowRight size={15} />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Explanation Panel */}
            {!isExamMode && isSubmitted && submittedEntry?.result && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '18px',
                  borderRadius: '10px',
                  backgroundColor: submittedEntry.result.is_correct
                    ? 'var(--success-soft)'
                    : 'var(--bg-subtle)',
                  border: `1px solid ${
                    submittedEntry.result.is_correct ? 'var(--success)' : 'var(--border)'
                  }`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: submittedEntry.result.is_correct
                      ? 'var(--success)'
                      : 'var(--danger)',
                  }}
                >
                  {submittedEntry.result.is_correct ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Correct Answer (+4 marks)</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={18} />
                      <span>
                        Incorrect (-1 mark) — Correct Option is{' '}
                        {String.fromCharCode(65 + submittedEntry.result.correct_option_index)}
                      </span>
                    </>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                  }}
                >
                  Explanation
                </div>
                <div
                  className="medical-html-content"
                  style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{
                    __html: formatMedicalHtml(
                      submittedEntry.result.explanation ||
                        currentQ.explanation?.html_content ||
                        currentQ.explanation?.text ||
                        'No explanation provided for this MCQ.'
                    ),
                  }}
                />
                {(submittedEntry.result.references || currentQ.explanation?.references) && (
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px dashed var(--border)',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <strong>References:</strong>{' '}
                    {submittedEntry.result.references || currentQ.explanation?.references}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Question Navigator Palette */}
        <aside className="ui-card" style={{ padding: '16px', alignSelf: 'start', position: 'sticky', top: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Question Palette
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              const qSubmitted = ans !== undefined && ans.selectedIndex !== null;
              const qMarked = markedSet.has(q.id);
              const qSkipped = skippedSet.has(q.id);
              const isCurrent = idx === currentQIndex;

              let bg = 'var(--bg-subtle)';
              let color = 'var(--text-secondary)';
              let border = 'var(--border)';

              if (!isExamMode && qSubmitted && ans.result) {
                if (ans.result.is_correct) {
                  bg = 'var(--success-soft)';
                  color = 'var(--success)';
                  border = 'var(--success)';
                } else {
                  bg = 'var(--danger-soft)';
                  color = 'var(--danger)';
                  border = 'var(--danger)';
                }
              } else if (qSubmitted) {
                bg = 'var(--primary-soft)';
                color = 'var(--primary)';
                border = 'var(--primary)';
              } else if (qMarked) {
                bg = 'var(--accent-soft)';
                color = 'var(--accent)';
                border = 'var(--accent)';
              } else if (qSkipped) {
                bg = 'var(--bg-card)';
                color = 'var(--text-muted)';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQIndex(idx)}
                  aria-label={`Jump to question ${idx + 1}`}
                  style={{
                    position: 'relative',
                    height: '36px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isCurrent ? 'var(--text-primary)' : border}`,
                    backgroundColor: bg,
                    color,
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: isCurrent ? '0 0 0 2px var(--primary-soft)' : 'none',
                  }}
                >
                  {idx + 1}
                  {qMarked && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--border)',
              paddingTop: '12px',
            }}
          >
            {!isExamMode ? (
              <>
                <LegendDot color="var(--success)" label="Correct" />
                <LegendDot color="var(--danger)" label="Wrong" />
              </>
            ) : (
              <LegendDot color="var(--primary)" label="Answered" />
            )}
            <LegendDot color="var(--accent)" label="Marked" />
            <LegendDot color="var(--text-muted)" label="Unattempted" />
          </div>
        </aside>
      </div>

      {/* Confirm Finish Modal */}
      {confirmFinishOpen && (
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
          <div className="ui-card" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Finish Session?
            </h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              You have answered {answeredCount} of {questions.length} questions. Submit to calculate your +4 / -1 score and review detailed answers.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmFinishOpen(false)}
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
                Continue Solving
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmFinish(false)}
                disabled={finishing}
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
                {finishing ? 'Submitting...' : 'Submit & View Summary'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Error Modal */}
      {reportOpen && (
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
            onSubmit={handleSubmitReport}
            className="ui-card"
            style={{ width: '100%', maxWidth: '440px', padding: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Report an Error (MCQ #{currentQ.id})
              </h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                aria-label="Close report dialog"
                style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {['Wrong Answer Key', 'Ambiguous Question', 'Typo or Formatting', 'Broken or Wrong Image', 'Other'].map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={reportReason === reason}
                    onChange={(e) => setReportReason(e.target.value)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional explanation or textbook reference..."
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
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
                disabled={reportSubmitting}
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
                {reportSubmitting ? 'Sending...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: color, flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

/* ===========================
   END-OF-DRILL RESULT SUMMARY
=========================== */

export interface SolverSummaryViewProps {
  session: TestSession;
  onReattemptWrong: (wrongQuestionIds: number[], title: string) => void;
  onBackToSubjects: () => void;
  onReviewAttempted: () => void;
}

export const SolverSummaryView: React.FC<SolverSummaryViewProps> = ({
  session,
  onReattemptWrong,
  onBackToSubjects,
  onReviewAttempted,
}) => {
  const questions = session.questions || [];
  const responsesMap = useMemo(() => {
    const map: Record<number, { selected: number | null; isCorrect: boolean | null; time: number }> = {};
    (session.responses || []).forEach((r) => {
      map[r.question_id] = {
        selected: r.selected_option_index,
        isCorrect: r.is_correct,
        time: r.time_spent_seconds || 0,
      };
    });
    return map;
  }, [session.responses]);

  const wrongQuestions = useMemo(() => {
    return questions.filter((q) => {
      const resp = responsesMap[q.id];
      return resp && resp.selected !== null && resp.isCorrect === false;
    });
  }, [questions, responsesMap]);

  const attemptedCount = (session.correct_count || 0) + (session.incorrect_count || 0);
  const maxMarks = (session.total_questions || questions.length) * 4;
  const neetScore = session.score ?? (session.correct_count || 0) * 4 - (session.incorrect_count || 0);
  const avgSec =
    attemptedCount > 0 && session.total_time_seconds
      ? Math.round(session.total_time_seconds / attemptedCount)
      : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="ui-card" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {session.title} — Completed
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                NEET PG Scoring (+4 Correct, -1 Incorrect)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {wrongQuestions.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onReattemptWrong(
                    wrongQuestions.map((q) => q.id),
                    `Re-attempt Wrong (${session.title})`
                  )
                }
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
                <Sparkles size={15} /> Re-attempt Wrong ({wrongQuestions.length})
              </button>
            )}
            <button
              type="button"
              onClick={onReviewAttempted}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Attempted Log
            </button>
            <button
              type="button"
              onClick={onBackToSubjects}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Subjects
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          <SummaryMetric label="NEET PG Score" value={`${neetScore} / ${maxMarks}`} tone="var(--primary)" />
          <SummaryMetric
            label="Accuracy"
            value={`${Math.round(session.accuracy_percentage || 0)}%`}
            tone={(session.accuracy_percentage || 0) >= 60 ? 'var(--success)' : 'var(--danger)'}
          />
          <SummaryMetric
            label="Correct / Wrong / Skipped"
            value={`${session.correct_count} / ${session.incorrect_count} / ${session.skipped_count}`}
            tone="var(--text-primary)"
          />
          <SummaryMetric
            label="Avg Time / Question"
            value={avgSec > 0 ? `${avgSec}s` : '—'}
            tone="var(--accent)"
          />
        </div>
      </div>

      <div className="ui-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {wrongQuestions.length > 0
            ? `Incorrect Answers to Review (${wrongQuestions.length})`
            : 'No Incorrect Answers'}
        </h3>

        {wrongQuestions.length === 0 ? (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
            Great job — none of your attempted questions in this session were wrong.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {wrongQuestions.map((q) => {
              const resp = responsesMap[q.id];
              const yourLetter =
                resp?.selected !== null && resp?.selected !== undefined
                  ? String.fromCharCode(65 + resp.selected)
                  : '-';
              const corrOptIdx = q.options?.findIndex((o) => o.is_correct) ?? -1;
              const corrLetter = corrOptIdx >= 0 ? String.fromCharCode(65 + corrOptIdx) : '-';
              const explHtml = q.explanation?.html_content || q.explanation?.text;

              return (
                <div
                  key={q.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-subtle)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {q.subject_name || 'MCQ'} {q.topic_name ? `• ${q.topic_name}` : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 700 }}>
                      <span style={{ color: 'var(--danger)' }}>Your Answer: {yourLetter}</span>
                      <span style={{ color: 'var(--success)' }}>Correct: {corrLetter}</span>
                      {resp?.time ? <span style={{ color: 'var(--text-muted)' }}>{resp.time}s</span> : null}
                    </div>
                  </div>
                  <div
                    className="medical-html-content"
                    style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}
                    dangerouslySetInnerHTML={{ __html: formatMedicalHtml(q.html_content || q.text) }}
                  />
                  {explHtml && (
                    <div
                      className="medical-html-content"
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        paddingTop: '8px',
                        borderTop: '1px dashed var(--border)',
                      }}
                      dangerouslySetInnerHTML={{ __html: formatMedicalHtml(explHtml) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: tone }}>{value}</div>
    </div>
  );
}
