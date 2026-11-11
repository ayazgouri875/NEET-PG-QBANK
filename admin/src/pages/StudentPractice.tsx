import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import {
  AttemptedQuestionItem,
  AttemptedQuestionsStats,
  BookmarkItem,
  QuestionItem,
  StudentAnalytics,
  SubjectItem,
  SubmitAnswerResult,
  SubtopicItem,
  TestSession,
  TopicItem,
} from '../types';

const formatMedicalHtml = (html?: string) => {
  if (!html) return '';
  return html.replace(/src=["'](?!(?:https?:\/\/|\/|data:))([^"']+)["']/g, 'src="/media/images/$1"');
};

export const StudentPractice: React.FC = () => {
  // Navigation views: 'curriculum' | 'topics' | 'problems' | 'attempted' | 'solving' | 'summary' | 'generator' | 'bookmarks' | 'analytics'
  const [subView, setSubView] = useState<'curriculum' | 'topics' | 'problems' | 'attempted' | 'solving' | 'summary' | 'generator' | 'bookmarks' | 'analytics'>('curriculum');

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Solving / Test State
  const [activeSession, setActiveSession] = useState<TestSession | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, { selectedIndex: number | null; result?: SubmitAnswerResult }>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<number, boolean>>({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Expanded explanations in Attempted list
  const [expandedExplanation, setExpandedExplanation] = useState<Record<number, boolean>>({});

  // Modal / Zoom Image
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // --- TOPIC & SUBTOPIC HUB STATE ---
  const [selectedSubjectForTopics, setSelectedSubjectForTopics] = useState<SubjectItem | null>(null);
  const [subjectTopics, setSubjectTopics] = useState<TopicItem[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicSearchText, setTopicSearchText] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});

  // --- QUESTION DIRECTORY STATE ---
  const [problems, setProblems] = useState<QuestionItem[]>([]);
  const [problemPage, setProblemPage] = useState(1);
  const [problemTotal, setProblemTotal] = useState(0);
  const [problemStatusFilter, setProblemStatusFilter] = useState<'all' | 'attempted' | 'solved' | 'incorrect' | 'unattempted'>('all');
  const [problemSubjectFilter, setProblemSubjectFilter] = useState<number | ''>('');
  const [problemTopicFilter, setProblemTopicFilter] = useState<number | ''>('');
  const [problemSubtopicFilter, setProblemSubtopicFilter] = useState<number | ''>('');
  const [problemTopics, setProblemTopics] = useState<TopicItem[]>([]);
  const [problemDifficultyFilter, setProblemDifficultyFilter] = useState<string>('');
  const [problemSearch, setProblemSearch] = useState<string>('');
  const [groupByTopic, setGroupByTopic] = useState(false);

  // --- ATTEMPTED QUESTIONS / SUBMISSIONS STATE ---
  const [attemptedItems, setAttemptedItems] = useState<AttemptedQuestionItem[]>([]);
  const [attemptedStats, setAttemptedStats] = useState<AttemptedQuestionsStats | null>(null);
  const [attemptedPage, setAttemptedPage] = useState(1);
  const [attemptedTotal, setAttemptedTotal] = useState(0);
  const [attemptedStatusFilter, setAttemptedStatusFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [attemptedSubjectFilter, setAttemptedSubjectFilter] = useState<number | ''>('');
  const [attemptedSearch, setAttemptedSearch] = useState<string>('');

  // Generator State
  const [genTitle, setGenTitle] = useState('Custom High-Yield MCQ Drill');
  const [genSubjects, setGenSubjects] = useState<number[]>([]);
  const [genCount, setGenCount] = useState(15);
  const [genMode, setGenMode] = useState<'practice' | 'exam'>('practice');
  const [genDifficulty, setGenDifficulty] = useState<string>('');

  // Bookmarks & Analytics
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);

  // Load Subjects on mount
  useEffect(() => {
    loadSubjects();
  }, []);

  // Timer loop for active solving session (only runs if isTimerRunning is true)
  useEffect(() => {
    let interval: any = null;
    if (subView === 'solving' && activeSession && activeSession.status === 'in_progress' && isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [subView, activeSession, isTimerRunning]);

  // When problemSubjectFilter changes, load its topics
  useEffect(() => {
    if (problemSubjectFilter !== '') {
      adminApi.fetchTopics(Number(problemSubjectFilter))
        .then((t) => setProblemTopics(t))
        .catch(() => setProblemTopics([]));
    } else {
      setProblemTopics([]);
      setProblemTopicFilter('');
      setProblemSubtopicFilter('');
    }
  }, [problemSubjectFilter]);

  // When problemTopicFilter changes, reset subtopic filter
  useEffect(() => {
    setProblemSubtopicFilter('');
  }, [problemTopicFilter]);

  // Reload problem set when filters change
  useEffect(() => {
    if (subView === 'problems') {
      loadProblems();
    }
  }, [subView, problemPage, problemStatusFilter, problemSubjectFilter, problemTopicFilter, problemSubtopicFilter, problemDifficultyFilter]);

  // Reload attempted questions when filters change
  useEffect(() => {
    if (subView === 'attempted') {
      loadAttemptedQuestions();
    }
  }, [subView, attemptedPage, attemptedStatusFilter, attemptedSubjectFilter]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await adminApi.fetchSubjects();
      setSubjects(list);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  const loadProblems = async () => {
    try {
      setLoading(true);
      const res = await adminApi.fetchQuestions({
        page: problemPage,
        page_size: groupByTopic ? 50 : 20,
        subject_id: problemSubjectFilter !== '' ? Number(problemSubjectFilter) : undefined,
        topic_id: problemTopicFilter !== '' ? Number(problemTopicFilter) : undefined,
        subtopic_id: problemSubtopicFilter !== '' ? Number(problemSubtopicFilter) : undefined,
        difficulty: problemDifficultyFilter || undefined,
        status_filter: problemStatusFilter !== 'all' ? problemStatusFilter : undefined,
        q: problemSearch || undefined,
      });
      setProblems(res.items);
      setProblemTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load problems:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttemptedQuestions = async () => {
    try {
      setLoading(true);
      const res = await adminApi.fetchAttemptedQuestions({
        page: attemptedPage,
        page_size: 15,
        status_filter: attemptedStatusFilter !== 'all' ? attemptedStatusFilter : undefined,
        subject_id: attemptedSubjectFilter !== '' ? Number(attemptedSubjectFilter) : undefined,
        q: attemptedSearch || undefined,
      });
      setAttemptedItems(res.items);
      setAttemptedStats(res.stats);
      setAttemptedTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load attempted questions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Open the Topic Explorer for a specific subject
  const openSubjectTopics = async (subj: SubjectItem) => {
    try {
      setTopicsLoading(true);
      setSelectedSubjectForTopics(subj);
      setTopicSearchText('');
      const topics = await adminApi.fetchTopics(subj.id);
      setSubjectTopics(topics);
      // Auto-expand all topics so all subtopics are immediately visible
      const initialExpanded: Record<number, boolean> = {};
      topics.forEach((t) => {
        initialExpanded[t.id] = true;
      });
      setExpandedTopics(initialExpanded);
      setSubView('topics');
    } catch (err: any) {
      alert(`Could not load topics for ${subj.name}: ${err.message}`);
    } finally {
      setTopicsLoading(false);
    }
  };

  // Start a Practice Drill for an entire Subject
  const startSubjectPractice = async (subjectId: number, subjectName: string) => {
    try {
      setLoading(true);
      setError(null);
      const session = await adminApi.createCustomTest({
        title: `${subjectName} Subject Practice Drill`,
        test_type: 'subject',
        test_mode: 'practice',
        subject_ids: [subjectId],
        question_count: 15,
        is_timed: false,
      });

      const fullSession = await adminApi.fetchTestSession(session.id);
      setActiveSession(fullSession);
      setCurrentQIndex(0);
      setAnswers({});
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setSubView('solving');
    } catch (err: any) {
      alert(`Could not start practice session: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Start a Practice Drill for a specific Topic within a Subject
  const startTopicPractice = async (subjectId: number, topicId: number, topicName: string) => {
    try {
      setLoading(true);
      setError(null);
      const session = await adminApi.createCustomTest({
        title: `${topicName} Topic Drill`,
        test_type: 'topic',
        test_mode: 'practice',
        subject_ids: [subjectId],
        topic_ids: [topicId],
        question_count: 15,
        is_timed: false,
      });

      const fullSession = await adminApi.fetchTestSession(session.id);
      setActiveSession(fullSession);
      setCurrentQIndex(0);
      setAnswers({});
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setSubView('solving');
    } catch (err: any) {
      alert(`Could not start topic practice: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Start a Practice Drill for a specific Subtopic within a Topic
  const startSubtopicPractice = async (subjectId: number, topicId: number, subtopicId: number, subtopicName: string) => {
    try {
      setLoading(true);
      setError(null);
      const session = await adminApi.createCustomTest({
        title: `${subtopicName} Subtopic Drill`,
        test_type: 'topic',
        test_mode: 'practice',
        subject_ids: [subjectId],
        topic_ids: [topicId],
        subtopic_ids: [subtopicId],
        question_count: 10,
        is_timed: false,
      });

      const fullSession = await adminApi.fetchTestSession(session.id);
      setActiveSession(fullSession);
      setCurrentQIndex(0);
      setAnswers({});
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setSubView('solving');
    } catch (err: any) {
      alert(`Could not start subtopic practice: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Solve an individual question directly
  const solveSingleQuestion = async (q: QuestionItem | AttemptedQuestionItem) => {
    try {
      setLoading(true);
      const qDetail = await adminApi.fetchQuestionDetail(q.id || (q as any).question_id);

      const syntheticSession: TestSession = {
        id: 0,
        user_id: 1,
        title: `MCQ #${qDetail.id}: ${qDetail.mcq_id || 'Clinical Vignette'}`,
        test_type: 'custom',
        test_mode: 'practice',
        status: 'in_progress',
        total_questions: 1,
        is_timed: false,
        score: 0,
        correct_count: 0,
        incorrect_count: 0,
        skipped_count: 0,
        accuracy_percentage: 0,
        started_at: new Date().toISOString(),
        questions: [qDetail],
      };

      setActiveSession(syntheticSession);
      setCurrentQIndex(0);
      setAnswers({});
      setTimerSeconds(0);
      setIsTimerRunning(false);
      setSubView('solving');
    } catch (err: any) {
      alert(`Could not open question: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (optionIndex: number) => {
    if (!activeSession || !activeSession.questions || activeSession.questions.length === 0) return;
    const currentQ = activeSession.questions[currentQIndex];
    if (!currentQ) return;

    if (activeSession.test_mode === 'practice' && answers[currentQ.id]?.selectedIndex !== undefined) {
      return;
    }

    try {
      setSubmitting(true);
      let result: SubmitAnswerResult;

      if (activeSession.id === 0) {
        result = await adminApi.solveQuestionDirectly(currentQ.id, optionIndex, 12);
      } else {
        result = await adminApi.submitAnswer(activeSession.id, currentQ.id, optionIndex, 10);
      }

      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: {
          selectedIndex: optionIndex,
          result: result,
        },
      }));
    } catch (err: any) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBookmark = async (questionId: number) => {
    try {
      const res = await adminApi.toggleBookmark(questionId);
      setBookmarkedMap((prev) => ({
        ...prev,
        [questionId]: res.bookmarked,
      }));
    } catch (err: any) {
      console.error('Bookmark toggle error:', err);
    }
  };

  const handleCompleteTest = async () => {
    if (!activeSession) return;
    if (activeSession.id === 0) {
      setSubView('attempted');
      return;
    }

    const confirm = window.confirm('Are you sure you want to finish this test session and calculate your NEET PG score?');
    if (!confirm) return;

    try {
      setLoading(true);
      const summary = await adminApi.completeTest(activeSession.id);
      setActiveSession(summary);
      setSubView('summary');
    } catch (err: any) {
      alert(`Error finalizing test: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchCustomTest = async () => {
    try {
      setLoading(true);
      const session = await adminApi.createCustomTest({
        title: genTitle,
        test_type: 'custom',
        test_mode: genMode,
        subject_ids: genSubjects.length > 0 ? genSubjects : undefined,
        question_count: genCount,
        is_timed: genMode === 'exam',
        duration_minutes: genMode === 'exam' ? genCount : undefined,
        difficulty: genDifficulty || undefined,
      });

      const fullSession = await adminApi.fetchTestSession(session.id);
      setActiveSession(fullSession);
      setCurrentQIndex(0);
      setAnswers({});
      setTimerSeconds(0);
      setIsTimerRunning(genMode === 'exam');
      setSubView('solving');
    } catch (err: any) {
      alert(`Could not generate test: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openBookmarks = async () => {
    try {
      setLoading(true);
      const list = await adminApi.fetchBookmarks();
      setBookmarks(list);
      setSubView('bookmarks');
    } catch (err: any) {
      alert(`Failed to load bookmarks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openAnalytics = async () => {
    try {
      setLoading(true);
      const data = await adminApi.fetchStudentAnalytics();
      setAnalytics(data);
      setSubView('analytics');
    } catch (err: any) {
      alert(`Failed to load analytics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const preClinical = subjects.filter((s) => s.category === 'pre_clinical' || s.category === 'pre-clinical');
  const paraClinical = subjects.filter((s) => s.category === 'para_clinical' || s.category === 'para-clinical');
  const clinical = subjects.filter((s) => s.category === 'clinical');
  const otherSubjects = subjects.filter((s) => !['pre_clinical', 'pre-clinical', 'para_clinical', 'para-clinical', 'clinical'].includes(s.category));

  // Group questions by topic for the directory table
  const groupedProblemsByTopic: Record<string, QuestionItem[]> = {};
  if (groupByTopic) {
    for (const p of problems) {
      const topicKey = p.topic_name || 'General / Uncategorized Topic';
      if (!groupedProblemsByTopic[topicKey]) {
        groupedProblemsByTopic[topicKey] = [];
      }
      groupedProblemsByTopic[topicKey].push(p);
    }
  }

  return (
    <div style={{ padding: 'clamp(12px, 2.5vw, 24px)', maxWidth: '1380px', margin: '0 auto', fontFamily: 'inherit', width: '100%' }}>
      {/* Top Banner Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '20px',
        border: '1px solid #E2E8F0',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#0D9488',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            🩺
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              NEET PG Student Question Bank
            </h2>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Marrow & PrepLadder inspired test solver • 19,225 active high-yield MCQs across 283 topics
            </span>
          </div>
        </div>

        {/* Scrollable Sub-View Navigation Bar */}
        <div
          className="horizontal-scroll-row"
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            width: '100%',
            maxWidth: '100%',
            padding: '2px 0 4px',
            scrollbarWidth: 'none',
          }}
        >
          <button
            onClick={() => setSubView('curriculum')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: subView === 'curriculum' || subView === 'topics' ? '#0F172A' : '#F1F5F9',
              color: subView === 'curriculum' || subView === 'topics' ? '#FFFFFF' : '#475569',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            📚 19 Subjects & Topics
          </button>

          <button
            onClick={() => setSubView('problems')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: subView === 'problems' ? '#0F172A' : '#F1F5F9',
              color: subView === 'problems' ? '#FFFFFF' : '#475569',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            📋 Question Directory (All MCQs)
          </button>

          <button
            onClick={() => setSubView('attempted')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: subView === 'attempted' ? '#059669' : '#ECFDF5',
              color: subView === 'attempted' ? '#FFFFFF' : '#047857',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            🎯 Attempted Questions & Answers
          </button>

          <button
            onClick={() => setSubView('generator')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: subView === 'generator' ? '#0F172A' : '#F1F5F9',
              color: subView === 'generator' ? '#FFFFFF' : '#475569',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ⚡ Custom Test
          </button>

          <button
            onClick={openBookmarks}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: subView === 'bookmarks' ? '#0F172A' : '#F1F5F9',
              color: subView === 'bookmarks' ? '#FFFFFF' : '#475569',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            ⭐ Bookmarks
          </button>

          <button
            onClick={openAnalytics}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: subView === 'analytics' ? '#0F172A' : '#F1F5F9',
              color: subView === 'analytics' ? '#FFFFFF' : '#475569',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            📊 Analytics
          </button>
        </div>
      </div>

      {/* Backend Offline Banner */}
      {error && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '10px',
          color: '#991B1B',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <strong>Backend Connection Issue:</strong> {error}
            <div style={{ fontSize: '12px', marginTop: '4px', color: '#B91C1C' }}>
              Ensure your backend is running: <code>./start_backend.sh</code> on port 8000.
            </div>
          </div>
          <button
            onClick={loadSubjects}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: '#991B1B',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. SUBJECT TOPICS & SUBTOPICS HUB (TOPIC-WISE DRILL)          */}
      {/* ============================================================== */}
      {subView === 'topics' && selectedSubjectForTopics && (() => {
        const totalSubtopics = subjectTopics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0);
        const filteredTopics = subjectTopics.filter((t) => {
          if (!topicSearchText.trim()) return true;
          const q = topicSearchText.toLowerCase();
          if (t.name.toLowerCase().includes(q)) return true;
          if (t.subtopics && t.subtopics.some((s) => s.name.toLowerCase().includes(q))) return true;
          return false;
        });

        const toggleAllTopics = (expand: boolean) => {
          const updated: Record<number, boolean> = {};
          subjectTopics.forEach((t) => {
            updated[t.id] = expand;
          });
          setExpandedTopics(updated);
        };

        return (
          <div>
            {/* Breadcrumb & Subject Header */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px 28px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <button
                onClick={() => setSubView('curriculum')}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#2563EB',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ← Back to All 19 Subjects
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      {selectedSubjectForTopics.name} Curriculum Hub
                    </h3>
                    <span style={{
                      backgroundColor: '#E0F2FE',
                      color: '#0369A1',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      {selectedSubjectForTopics.code}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0' }}>
                    {subjectTopics.length} Medical Topics • {totalSubtopics} Deep Clinical Subtopics • {selectedSubjectForTopics.total_questions.toLocaleString()} Verified High-Yield MCQs
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => startSubjectPractice(selectedSubjectForTopics.id, selectedSubjectForTopics.name)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#0D9488',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>⚡ Practice Entire Subject (15 Qs)</span>
                  </button>

                  <button
                    onClick={() => {
                      setProblemSubjectFilter(selectedSubjectForTopics.id);
                      setProblemTopicFilter('');
                      setProblemSubtopicFilter('');
                      setSubView('problems');
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>📋 Question Directory</span>
                  </button>
                </div>
              </div>

              {/* Subtopic Navigation & Filter Bar */}
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
                  <input
                    type="text"
                    placeholder="Search topics or subtopics (e.g. Cranial, Embryo, Nerve)..."
                    value={topicSearchText}
                    onChange={(e) => setTopicSearchText(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      width: '100%',
                      maxWidth: '380px',
                      backgroundColor: '#F8FAFC',
                    }}
                  />
                  {topicSearchText && (
                    <button
                      onClick={() => setTopicSearchText('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => toggleAllTopics(true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    ▾ Expand All Subtopics
                  </button>
                  <button
                    onClick={() => toggleAllTopics(false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    ▴ Collapse All
                  </button>
                </div>
              </div>
            </div>

            {/* Grid of Topics with Detailed Subtopics inside each Topic */}
            {topicsLoading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
                Loading subject topics & detailed subtopics...
              </div>
            ) : filteredTopics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#64748B', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
                No topics or subtopics match "{topicSearchText}".
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '16px', alignItems: 'start' }}>
                {filteredTopics.map((topic) => {
                  const prog = topic.user_progress;
                  const attempted = prog?.attempted || 0;
                  const solved = prog?.solved || 0;
                  const accuracy = prog?.accuracy_percentage || 0;
                  const solvedPct = topic.total_questions > 0 ? (solved / topic.total_questions) * 100 : 0;
                  const isExpanded = expandedTopics[topic.id] ?? true;
                  const subCount = topic.subtopics?.length || 0;

                  return (
                    <div
                      key={topic.id}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div>
                        {/* Topic Title & Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                            {topic.name}
                          </h4>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <span style={{
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}>
                              {topic.total_questions} MCQs
                            </span>
                            <span style={{
                              backgroundColor: '#EEF2FF',
                              color: '#4338CA',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}>
                              {subCount} Subtopics
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                            <span>Solved: {solved} / {topic.total_questions}</span>
                            {attempted > 0 && (
                              <span style={{ fontWeight: 700, color: accuracy >= 70 ? '#059669' : accuracy >= 50 ? '#D97706' : '#DC2626' }}>
                                {accuracy}% accuracy
                              </span>
                            )}
                          </div>
                          <div style={{
                            width: '100%',
                            height: '6px',
                            backgroundColor: '#F1F5F9',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.min(solvedPct, 100)}%`,
                              height: '100%',
                              backgroundColor: solvedPct >= 100 ? '#059669' : '#10B981',
                              borderRadius: '3px',
                            }} />
                          </div>
                        </div>
                      </div>

                      {/* Topic Level Actions */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => startTopicPractice(selectedSubjectForTopics.id, topic.id, topic.name)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#0D9488',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>⚡ Topic Drill (15 Qs)</span>
                        </button>

                        <button
                          onClick={() => {
                            setProblemSubjectFilter(selectedSubjectForTopics.id);
                            setProblemTopicFilter(topic.id);
                            setProblemSubtopicFilter('');
                            setSubView('problems');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #CBD5E1',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>💻 All Topic Qs</span>
                        </button>

                        {subCount > 0 && (
                          <button
                            onClick={() => setExpandedTopics((prev) => ({ ...prev, [topic.id]: !isExpanded }))}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              backgroundColor: isExpanded ? '#EEF2FF' : '#F8FAFC',
                              color: isExpanded ? '#4338CA' : '#64748B',
                              border: isExpanded ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px',
                            }}
                          >
                            <span>{isExpanded ? '▲ Subtopics' : `▼ Subtopics (${subCount})`}</span>
                          </button>
                        )}
                      </div>

                      {/* Detailed Subtopics Accordion / Nested Tree */}
                      {isExpanded && topic.subtopics && topic.subtopics.length > 0 && (
                        <div style={{
                          marginTop: '6px',
                          paddingTop: '12px',
                          borderTop: '1px solid #F1F5F9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Detailed Subtopics ({topic.subtopics.length})
                            </span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                              Direct Subtopic Drill & MCQs
                            </span>
                          </div>

                          {topic.subtopics.map((sub) => {
                            const subProg = sub.user_progress;
                            const subAttempted = subProg?.attempted || 0;
                            const subSolved = subProg?.solved || 0;
                            const subAccuracy = subProg?.accuracy_percentage || 0;

                            return (
                              <div
                                key={sub.id}
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  padding: '10px 12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '10px',
                                  transition: 'background-color 0.15s ease',
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>
                                      {sub.name}
                                    </span>
                                    <span style={{
                                      backgroundColor: '#EEF2FF',
                                      color: '#4338CA',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: 700,
                                    }}>
                                      {sub.total_questions} MCQs
                                    </span>
                                  </div>

                                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {subAttempted > 0 ? (
                                      <>
                                        <span style={{ color: subSolved > 0 ? '#059669' : '#DC2626', fontWeight: 700 }}>
                                          {subSolved > 0 ? '✓' : '✕'} Solved: {subSolved} / {sub.total_questions}
                                        </span>
                                        <span>•</span>
                                        <span style={{ color: subAccuracy >= 70 ? '#059669' : '#D97706', fontWeight: 600 }}>
                                          {subAccuracy}% accuracy
                                        </span>
                                      </>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>○ Unattempted</span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                                  <button
                                    onClick={() => startSubtopicPractice(selectedSubjectForTopics.id, topic.id, sub.id, sub.name)}
                                    title={`Start 10 MCQs practice drill on ${sub.name}`}
                                    style={{
                                      padding: '5px 9px',
                                      borderRadius: '6px',
                                      backgroundColor: '#0D9488',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <span>⚡ Drill</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setProblemSubjectFilter(selectedSubjectForTopics.id);
                                      setProblemTopicFilter(topic.id);
                                      setProblemSubtopicFilter(sub.id);
                                      setSubView('problems');
                                    }}
                                    title={`Browse all ${sub.total_questions} MCQs in directory`}
                                    style={{
                                      padding: '5px 9px',
                                      borderRadius: '6px',
                                      backgroundColor: '#FFFFFF',
                                      color: '#334155',
                                      border: '1px solid #CBD5E1',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <span>📋 MCQs</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* 2. QUESTION DIRECTORY VIEW (TOPIC-WISE & TABLE VIEW)          */}
      {/* ============================================================== */}
      {subView === 'problems' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                📋 NEET PG Question Directory (19,225 MCQs)
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                Topic-wise clinical practice questions. Solved items turn green, mistakes turn red with explanations.
              </p>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Group By Topic Toggle */}
              <button
                onClick={() => setGroupByTopic(!groupByTopic)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: groupByTopic ? '#0D9488' : '#F1F5F9',
                  color: groupByTopic ? '#FFFFFF' : '#334155',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>📂 {groupByTopic ? 'Grouped by Topic ✓' : 'Group by Topic'}</span>
              </button>

              <select
                value={problemStatusFilter}
                onChange={(e) => {
                  setProblemStatusFilter(e.target.value as any);
                  setProblemPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="solved">✓ Solved Only</option>
                <option value="incorrect">✕ Incorrect Only</option>
                <option value="attempted">⚡ Any Attempted</option>
                <option value="unattempted">○ Unattempted (Todo)</option>
              </select>

              <select
                value={problemSubjectFilter}
                onChange={(e) => {
                  setProblemSubjectFilter(e.target.value ? Number(e.target.value) : '');
                  setProblemTopicFilter('');
                  setProblemPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 600,
                }}
              >
                <option value="">All 19 Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.total_questions} Qs)</option>
                ))}
              </select>

              {/* Dynamic Topic Dropdown */}
              {problemTopics.length > 0 && (
                <select
                  value={problemTopicFilter}
                  onChange={(e) => {
                    setProblemTopicFilter(e.target.value ? Number(e.target.value) : '');
                    setProblemPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #0D9488',
                    fontSize: '12px',
                    backgroundColor: '#F0FDF4',
                    color: '#065F46',
                    fontWeight: 600,
                    maxWidth: '220px',
                  }}
                >
                  <option value="">All Topics ({problemTopics.length})</option>
                  {problemTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.total_questions} Qs)</option>
                  ))}
                </select>
              )}

              {/* Dynamic Subtopic Dropdown */}
              {(() => {
                const currentTopic = problemTopics.find((t) => t.id === Number(problemTopicFilter));
                if (!currentTopic || !currentTopic.subtopics || currentTopic.subtopics.length === 0) return null;
                return (
                  <select
                    value={problemSubtopicFilter}
                    onChange={(e) => {
                      setProblemSubtopicFilter(e.target.value ? Number(e.target.value) : '');
                      setProblemPage(1);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #6366F1',
                      fontSize: '12px',
                      backgroundColor: '#EEF2FF',
                      color: '#4338CA',
                      fontWeight: 600,
                      maxWidth: '220px',
                    }}
                  >
                    <option value="">All Subtopics ({currentTopic.subtopics.length})</option>
                    {currentTopic.subtopics.map((st) => (
                      <option key={st.id} value={st.id}>{st.name} ({st.total_questions} Qs)</option>
                    ))}
                  </select>
                );
              })()}

              <select
                value={problemDifficultyFilter}
                onChange={(e) => {
                  setProblemDifficultyFilter(e.target.value);
                  setProblemPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <input
                type="text"
                placeholder="Search MCQs or keywords..."
                value={problemSearch}
                onChange={(e) => setProblemSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setProblemPage(1);
                    loadProblems();
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  width: '200px',
                }}
              />
            </div>
          </div>

          {/* Topic Pills Bar when a subject is chosen */}
          {problemTopics.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 0 16px',
              overflowX: 'auto',
              borderBottom: '1px solid #F1F5F9',
              marginBottom: '16px',
            }}>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px', flexShrink: 0 }}>
                Topics:
              </span>

              <button
                onClick={() => {
                  setProblemTopicFilter('');
                  setProblemPage(1);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: problemTopicFilter === '' ? '#0F172A' : '#F1F5F9',
                  color: problemTopicFilter === '' ? '#FFFFFF' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                All Topics ({problemTopics.length})
              </button>

              {problemTopics.map((t) => {
                const isActive = problemTopicFilter === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setProblemTopicFilter(t.id);
                      setProblemPage(1);
                    }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: isActive ? '#0D9488' : '#F8FAFC',
                      color: isActive ? '#FFFFFF' : '#334155',
                      border: isActive ? 'none' : '1px solid #E2E8F0',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {t.name} ({t.total_questions})
                  </button>
                );
              })}
            </div>
          )}

          {/* Subtopic Pills Bar when a topic is selected */}
          {(() => {
            const currentTopic = problemTopics.find((t) => t.id === Number(problemTopicFilter));
            if (!currentTopic || !currentTopic.subtopics || currentTopic.subtopics.length === 0) return null;

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0 16px',
                overflowX: 'auto',
                borderBottom: '1px solid #F1F5F9',
                marginBottom: '16px',
              }}>
                <span style={{ fontSize: '11px', color: '#4338CA', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px', flexShrink: 0 }}>
                  Subtopics:
                </span>

                <button
                  onClick={() => {
                    setProblemSubtopicFilter('');
                    setProblemPage(1);
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '14px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: problemSubtopicFilter === '' ? '#4338CA' : '#F1F5F9',
                    color: problemSubtopicFilter === '' ? '#FFFFFF' : '#475569',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  All Subtopics ({currentTopic.subtopics.length})
                </button>

                {currentTopic.subtopics.map((st) => {
                  const isSubActive = problemSubtopicFilter === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => {
                        setProblemSubtopicFilter(st.id);
                        setProblemPage(1);
                      }}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '14px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: isSubActive ? '#6366F1' : '#EEF2FF',
                        color: isSubActive ? '#FFFFFF' : '#4338CA',
                        border: isSubActive ? 'none' : '1px solid #C7D2FE',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {st.name} ({st.total_questions})
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Table of Problems */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
              Loading questions...
            </div>
          ) : problems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
              No questions found matching your selected topic and filter criteria.
            </div>
          ) : groupByTopic ? (
            /* GROUPED BY TOPIC ACCORDION VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.entries(groupedProblemsByTopic).map(([topicTitle, tQuestions]) => (
                <div key={topicTitle} style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}>
                  {/* Topic Group Header */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '12px 18px',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>📂</span>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        {topicTitle}
                      </h4>
                      <span style={{
                        backgroundColor: '#E2E8F0',
                        color: '#475569',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}>
                        {tQuestions.length} MCQs
                      </span>
                    </div>

                    {tQuestions[0]?.topic_id && tQuestions[0]?.subject_id && (
                      <button
                        onClick={() => startTopicPractice(tQuestions[0].subject_id, tQuestions[0].topic_id!, topicTitle)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#0D9488',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Practice This Topic
                      </button>
                    )}
                  </div>

                  {/* Topic Questions List */}
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <tbody>
                        {tQuestions.map((p) => (
                          <ProblemRow key={p.id} p={p} onSolve={() => solveSingleQuestion(p)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* FLAT TABLE VIEW WITH TOPIC BADGES */
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px', width: '90px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Question / Clinical Vignette</th>
                    <th style={{ padding: '12px 14px', width: '220px' }}>Subject & Topic</th>
                    <th style={{ padding: '12px 14px', width: '100px' }}>Difficulty</th>
                    <th style={{ padding: '12px 14px', width: '110px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.map((p) => (
                    <ProblemRow key={p.id} p={p} onSolve={() => solveSingleQuestion(p)} showTopicBadge />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Showing {problems.length} of {problemTotal} questions
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={problemPage <= 1}
                onClick={() => setProblemPage((prev) => prev - 1)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  cursor: problemPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Previous
              </button>
              <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}>
                Page {problemPage}
              </span>
              <button
                disabled={problems.length < 20}
                onClick={() => setProblemPage((prev) => prev + 1)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  cursor: problems.length < 20 ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. ATTEMPTED QUESTIONS SECTION                                */}
      {/* ============================================================== */}
      {subView === 'attempted' && (
        <div>
          {/* Header Stats Bar */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  🎯 Attempted Questions & Submission History
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                  Track all your medical MCQ attempts, verify selected answers against verified keys, and re-attempt weak questions.
                </p>
              </div>

              {attemptedStats && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: '#F8FAFC',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Overall Accuracy:</span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: attemptedStats.accuracy_percentage >= 70 ? '#059669' : attemptedStats.accuracy_percentage >= 50 ? '#D97706' : '#DC2626',
                  }}>
                    {attemptedStats.accuracy_percentage}%
                  </span>
                </div>
              )}
            </div>

            {/* Attempted Metric Cards */}
            {attemptedStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <MetricBox label="Total Attempted" value={`${attemptedStats.total_attempted}`} color="#2563EB" icon="📝" />
                <MetricBox label="Solved (Correct)" value={`${attemptedStats.total_correct}`} color="#059669" icon="✓" sub="+4 marks each" />
                <MetricBox label="Incorrect (Review)" value={`${attemptedStats.total_incorrect}`} color="#DC2626" icon="✕" sub="-1 negative mark" />
                <MetricBox label="Easy Solved" value={`${attemptedStats.easy_attempted}`} color="#10B981" icon="🟢" />
                <MetricBox label="Hard Solved" value={`${attemptedStats.hard_attempted}`} color="#F43F5E" icon="🔴" />
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            padding: '14px 20px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            marginBottom: '16px',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            {/* Status Pills */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'correct', 'incorrect'] as const).map((st) => {
                const isActive = attemptedStatusFilter === st;
                const label = st === 'all' ? 'All Submissions' : st === 'correct' ? '✓ Correct Only' : '✕ Incorrect Only (Weak)';
                return (
                  <button
                    key={st}
                    onClick={() => {
                      setAttemptedStatusFilter(st);
                      setAttemptedPage(1);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: isActive ? (st === 'correct' ? '#059669' : st === 'incorrect' ? '#DC2626' : '#0F172A') : '#F1F5F9',
                      color: isActive ? '#FFFFFF' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Filter by Subject & Search */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={attemptedSubjectFilter}
                onChange={(e) => {
                  setAttemptedSubjectFilter(e.target.value ? Number(e.target.value) : '');
                  setAttemptedPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <option value="">All 19 Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search attempted MCQs..."
                value={attemptedSearch}
                onChange={(e) => setAttemptedSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setAttemptedPage(1);
                    loadAttemptedQuestions();
                  }
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  width: '200px',
                }}
              />
            </div>
          </div>

          {/* Submissions List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748B' }}>
              Loading your submission history...
            </div>
          ) : attemptedItems.length === 0 ? (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              padding: '60px 20px',
              textAlign: 'center',
              border: '1px solid #E2E8F0',
            }}>
              <span style={{ fontSize: '48px' }}>📝</span>
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', margin: '16px 0 6px' }}>
                No Attempted Questions Found
              </h4>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '400px', margin: '0 auto 20px' }}>
                You haven't attempted any questions matching this filter. Go to "All Questions" or "19 Subjects" to start practicing!
              </p>
              <button
                onClick={() => setSubView('problems')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Browse Question Bank →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {attemptedItems.map((item) => {
                const isExpanded = !!expandedExplanation[item.id];
                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: item.is_correct ? '1px solid #A7F3D0' : '1px solid #FECDD3',
                      borderLeft: item.is_correct ? '5px solid #10B981' : '5px solid #EF4444',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Header Row: Subject, Question ID, Correctness Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          backgroundColor: item.is_correct ? '#ECFDF5' : '#FEF2F2',
                          color: item.is_correct ? '#059669' : '#DC2626',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                        }}>
                          {item.is_correct ? '✓ Solved (+4)' : '✕ Incorrect (-1)'}
                        </span>

                        {item.subject_name && (
                          <span style={{
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}>
                            {item.subject_name}
                          </span>
                        )}

                        <span style={{
                          backgroundColor: '#F8FAFC',
                          color: '#64748B',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          textTransform: 'capitalize',
                        }}>
                          {item.difficulty}
                        </span>

                        {item.pyq_year && (
                          <span style={{
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            PYQ {item.pyq_year}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                        Attempted on {new Date(item.answered_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Question Vignette */}
                    <div
                      style={{ fontSize: '15px', lineHeight: '1.6', color: '#1E293B', fontWeight: 500, marginBottom: '16px' }}
                      dangerouslySetInnerHTML={{ __html: formatMedicalHtml(item.html_content || item.text) }}
                    />

                    {/* Submission Comparison Box */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      backgroundColor: '#F8FAFC',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      marginBottom: '14px',
                    }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                          Your Submitted Answer:
                        </span>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: item.is_correct ? '#059669' : '#DC2626',
                          marginTop: '4px',
                        }}>
                          {item.selected_option_label ? (
                            <>
                              Option {item.selected_option_label}: {item.selected_option_text}
                            </>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>Unattempted / Skipped</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
                          Verified Correct Answer:
                        </span>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#059669', marginTop: '4px' }}>
                          Option {item.correct_option_label}: {item.correct_option_text}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Re-Solve & Toggle Explanation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => setExpandedExplanation((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#0D9488',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {isExpanded ? '▲ Hide High-Yield Explanation' : '▼ View Marrow Explanation & References'}
                      </button>

                      <button
                        onClick={() => solveSingleQuestion(item)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          backgroundColor: item.is_correct ? '#0F172A' : '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{item.is_correct ? '🔄 Re-Solve Question' : '⚡ Re-Attempt Mistake'}</span>
                      </button>
                    </div>

                    {/* Expandable Explanation Sheet */}
                    {isExpanded && item.explanation && (
                      <div style={{
                        marginTop: '16px',
                        padding: '16px 20px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        borderLeft: '4px solid #0D9488',
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0D9488', marginBottom: '8px' }}>
                          💡 High-Yield Medical Explanation:
                        </div>
                        <div
                          style={{ fontSize: '13px', lineHeight: '1.7', color: '#334155' }}
                          dangerouslySetInnerHTML={{ __html: formatMedicalHtml(item.explanation.html_content || item.explanation.text) }}
                        />
                        {item.explanation.references && (
                          <div style={{ marginTop: '10px', fontSize: '11px', color: '#64748B' }}>
                            <strong>References:</strong> {item.explanation.references}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Showing {attemptedItems.length} of {attemptedTotal} attempted MCQs
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={attemptedPage <= 1}
                    onClick={() => setAttemptedPage((prev) => prev - 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      cursor: attemptedPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ← Previous
                  </button>
                  <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}>
                    Page {attemptedPage}
                  </span>
                  <button
                    disabled={attemptedItems.length < 15}
                    onClick={() => setAttemptedPage((prev) => prev + 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      cursor: attemptedItems.length < 15 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. CURRICULUM VIEW (19 SUBJECTS)                               */}
      {/* ============================================================== */}
      {subView === 'curriculum' && (
        <div>
          {/* Section: Pre-Clinical */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '18px' }}>🔬</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pre-Clinical Subjects (Phase I)
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
              {preClinical.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onViewTopics={() => openSubjectTopics(s)}
                  onStart={() => startSubjectPractice(s.id, s.name)}
                />
              ))}
            </div>
          </div>

          {/* Section: Para-Clinical */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '18px' }}>🧪</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Para-Clinical Subjects (Phase II)
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
              {paraClinical.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onViewTopics={() => openSubjectTopics(s)}
                  onStart={() => startSubjectPractice(s.id, s.name)}
                />
              ))}
            </div>
          </div>

          {/* Section: Clinical */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '18px' }}>🏥</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Clinical Subjects (Phase III & IV)
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
              {clinical.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onViewTopics={() => openSubjectTopics(s)}
                  onStart={() => startSubjectPractice(s.id, s.name)}
                />
              ))}
              {otherSubjects.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onViewTopics={() => openSubjectTopics(s)}
                  onStart={() => startSubjectPractice(s.id, s.name)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. SOLVING VIEW (MARROW / PREPLADDER MCQ ENGINE)               */}
      {/* ============================================================== */}
      {subView === 'solving' && activeSession && activeSession.questions && activeSession.questions.length > 0 && (
        <div>
          {/* MCQ Solver Top Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            padding: '12px 18px',
            borderRadius: '12px 12px 0 0',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                backgroundColor: activeSession.test_mode === 'practice' ? '#0D9488' : '#2563EB',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}>
                {activeSession.test_mode === 'practice' ? 'Practice Mode' : 'Exam Mode'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {activeSession.title}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Timer Controls */}
              {activeSession.test_mode === 'exam' ? (
                /* Exam Mode: Timed by default */
                <div style={{
                  backgroundColor: '#1E293B',
                  border: '1px solid #334155',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>⏱️</span>
                  <span>{formatTimer(timerSeconds)}</span>
                  <span style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase' }}>Exam</span>
                </div>
              ) : !isTimerRunning && timerSeconds === 0 ? (
                /* Practice Mode: Untimed by default, optional Start Timer */
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(true)}
                  title="Practice is untimed by default. Click to start a timer if you want to time yourself."
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#1E293B',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#0D9488';
                    (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#334155';
                    (e.currentTarget as HTMLElement).style.color = '#94A3B8';
                  }}
                >
                  <span>⏱️</span>
                  <span>Start Timer</span>
                </button>
              ) : isTimerRunning ? (
                /* Practice Mode: Timer Running */
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#1E293B',
                  borderRadius: '6px',
                  border: '1px solid #0D9488',
                  overflow: 'hidden',
                }}>
                  <span style={{
                    padding: '6px 10px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#38BDF8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <span>⏱️</span>
                    <span>{formatTimer(timerSeconds)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTimerRunning(false)}
                    title="Pause timer"
                    style={{
                      backgroundColor: '#334155',
                      color: '#F8FAFC',
                      border: 'none',
                      borderLeft: '1px solid #475569',
                      padding: '6px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ⏸ Pause
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerSeconds(0);
                    }}
                    title="Stop and reset timer"
                    style={{
                      backgroundColor: '#334155',
                      color: '#94A3B8',
                      border: 'none',
                      borderLeft: '1px solid #475569',
                      padding: '6px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                /* Practice Mode: Timer Paused */
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#1E293B',
                  borderRadius: '6px',
                  border: '1px solid #F59E0B',
                  overflow: 'hidden',
                }}>
                  <span style={{
                    padding: '6px 10px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#FBBF24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <span>⏱️</span>
                    <span>{formatTimer(timerSeconds)} (Paused)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTimerRunning(true)}
                    title="Resume timer"
                    style={{
                      backgroundColor: '#0D9488',
                      color: '#FFFFFF',
                      border: 'none',
                      borderLeft: '1px solid #475569',
                      padding: '6px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ▶ Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTimerRunning(false);
                      setTimerSeconds(0);
                    }}
                    title="Reset timer"
                    style={{
                      backgroundColor: '#334155',
                      color: '#94A3B8',
                      border: 'none',
                      borderLeft: '1px solid #475569',
                      padding: '6px 9px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Bookmark Button */}
              <button
                onClick={() => {
                  const currentQ = activeSession.questions![currentQIndex];
                  if (currentQ) handleToggleBookmark(currentQ.id);
                }}
                style={{
                  backgroundColor: bookmarkedMap[activeSession.questions[currentQIndex]?.id] ? '#F59E0B' : '#334155',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {bookmarkedMap[activeSession.questions[currentQIndex]?.id] ? '★ Bookmarked' : '☆ Bookmark'}
              </button>

              {/* Finish / Return Button */}
              <button
                onClick={handleCompleteTest}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {activeSession.id === 0 ? '← Exit Question' : 'Finish Test'}
              </button>
            </div>
          </div>

          {/* Question Palette Row */}
          {activeSession.questions.length > 1 && (
            <div style={{
              backgroundColor: '#1E293B',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
            }}>
              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginRight: '6px' }}>
                Palette:
              </span>
              {activeSession.questions.map((q, idx) => {
                const ans = answers[q.id];
                const isAnswered = ans && ans.selectedIndex !== null && ans.selectedIndex !== undefined;
                const isCurrent = idx === currentQIndex;
                let bg = '#334155';
                let color = '#F8FAFC';

                if (activeSession.test_mode === 'practice' && ans?.result) {
                  bg = ans.result.is_correct ? '#10B981' : '#EF4444';
                } else if (isAnswered) {
                  bg = '#2563EB';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQIndex(idx)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: bg,
                      color: color,
                      border: isCurrent ? '2px solid #38BDF8' : 'none',
                      fontWeight: isCurrent ? 800 : 500,
                      fontSize: '12px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Question Card */}
          {(() => {
            const currentQ = activeSession.questions[currentQIndex];
            const currentAns = answers[currentQ.id];
            const isPractice = activeSession.test_mode === 'practice';
            const showExplanation = isPractice && currentAns?.result !== undefined;

            return (
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '0 0 12px 12px',
                border: '1px solid #E2E8F0',
                borderTop: 'none',
                padding: 'clamp(16px, 3vw, 28px)',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}>
                {/* Question Metadata Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      backgroundColor: '#E0F2FE',
                      color: '#0369A1',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      Question {currentQIndex + 1} of {activeSession.questions.length}
                    </span>
                    {currentQ.is_clinical && (
                      <span style={{
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}>
                        Clinical Case Vignette
                      </span>
                    )}
                    {currentQ.difficulty && (
                      <span style={{
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}>
                        {currentQ.difficulty}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                    ID: {currentQ.mcq_id || `#${currentQ.id}`}
                  </span>
                </div>

                {/* Clinical Vignette Question Body */}
                <div
                  style={{
                    fontSize: '16px',
                    lineHeight: '1.7',
                    color: '#1E293B',
                    fontWeight: 500,
                    marginBottom: '20px',
                  }}
                  dangerouslySetInnerHTML={{ __html: formatMedicalHtml(currentQ.html_content || currentQ.text) }}
                />

                {/* Clinical Images if present */}
                {currentQ.images && currentQ.images.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '24px',
                    padding: '12px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}>
                    {currentQ.images.map((img) => {
                      const imgSrc = `/media/images/${img.filename}`;
                      return (
                        <div key={img.id} style={{ cursor: 'pointer' }} onClick={() => setZoomedImage(imgSrc)}>
                          <img
                            src={imgSrc}
                            alt={img.caption || 'Clinical Reference'}
                            style={{
                              maxWidth: '320px',
                              maxHeight: '220px',
                              objectFit: 'contain',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}
                          />
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', textAlign: 'center' }}>
                            🔍 Click to expand image
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* MCQ Options A, B, C, D */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                  {currentQ.options.map((opt, optIdx) => {
                    const isSelected = currentAns?.selectedIndex === optIdx;
                    const letter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || `${optIdx + 1}`;

                    let border = '1px solid #E2E8F0';
                    let bg = '#FFFFFF';
                    let labelBg = '#F1F5F9';
                    let labelColor = '#475569';

                    if (showExplanation && currentAns?.result) {
                      const isCorrectOpt = optIdx === currentAns.result.correct_option_index;
                      if (isCorrectOpt) {
                        border = '2px solid #10B981';
                        bg = '#ECFDF5';
                        labelBg = '#10B981';
                        labelColor = '#FFFFFF';
                      } else if (isSelected && !currentAns.result.is_correct) {
                        border = '2px solid #EF4444';
                        bg = '#FEF2F2';
                        labelBg = '#EF4444';
                        labelColor = '#FFFFFF';
                      }
                    } else if (isSelected) {
                      border = '2px solid #2563EB';
                      bg = '#EFF6FF';
                      labelBg = '#2563EB';
                      labelColor = '#FFFFFF';
                    }

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(optIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '14px 18px',
                          borderRadius: '10px',
                          border: border,
                          backgroundColor: bg,
                          cursor: (isPractice && currentAns?.result) ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: labelBg,
                          color: labelColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                          flexShrink: 0,
                        }}>
                          {letter}
                        </div>
                        <div
                          style={{ fontSize: '15px', color: '#1E293B', flex: 1 }}
                          dangerouslySetInnerHTML={{ __html: formatMedicalHtml(opt.html_content || opt.text) }}
                        />
                        {showExplanation && optIdx === currentAns?.result?.correct_option_index && (
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: '14px' }}>
                            ✓ Correct (+4)
                          </span>
                        )}
                        {showExplanation && isSelected && !currentAns?.result?.is_correct && (
                          <span style={{ color: '#DC2626', fontWeight: 700, fontSize: '14px' }}>
                            ✕ Incorrect (-1)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Marrow-Style High-Yield Explanation Box */}
                {showExplanation && currentAns?.result && (
                  <div style={{
                    marginTop: '24px',
                    padding: '24px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    borderLeft: '5px solid #0D9488',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '18px' }}>💡</span>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                        High-Yield Clinical Pearl & Explanation
                      </h4>
                    </div>

                    <div
                      style={{ fontSize: '14px', lineHeight: '1.7', color: '#334155' }}
                      dangerouslySetInnerHTML={{
                        __html: formatMedicalHtml(currentAns.result.explanation || currentQ.explanation?.html_content || 'Comprehensive explanation provided in source curriculum.'),
                      }}
                    />

                    {currentAns.result.references && (
                      <div style={{
                        marginTop: '16px',
                        paddingTop: '12px',
                        borderTop: '1px dashed #CBD5E1',
                        fontSize: '12px',
                        color: '#64748B',
                      }}>
                        <strong>Standard Textbook References:</strong> {currentAns.result.references}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Navigation Controls */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '32px',
                  paddingTop: '20px',
                  borderTop: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}>
                  {activeSession.questions.length > 1 ? (
                    <>
                      <button
                        disabled={currentQIndex === 0}
                        onClick={() => setCurrentQIndex((prev) => prev - 1)}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          backgroundColor: currentQIndex === 0 ? '#F1F5F9' : '#FFFFFF',
                          color: currentQIndex === 0 ? '#94A3B8' : '#0F172A',
                          border: '1px solid #CBD5E1',
                          fontWeight: 600,
                          cursor: currentQIndex === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ← Previous
                      </button>

                      <div style={{ fontSize: '13px', color: '#64748B' }}>
                        {Object.keys(answers).length} of {activeSession.questions.length} Answered
                      </div>

                      {currentQIndex < activeSession.questions.length - 1 ? (
                        <button
                          onClick={() => setCurrentQIndex((prev) => prev + 1)}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Next Question →
                        </button>
                      ) : (
                        <button
                          onClick={handleCompleteTest}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            backgroundColor: '#0D9488',
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Submit Test Results
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setSubView('problems')}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          backgroundColor: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #CBD5E1',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ← Back to Problem Set
                      </button>

                      <button
                        onClick={() => setSubView('attempted')}
                        style={{
                          padding: '10px 24px',
                          borderRadius: '8px',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          border: 'none',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View in Attempted Questions →
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. TEST SUMMARY / SCORECARD VIEW                               */}
      {/* ============================================================== */}
      {subView === 'summary' && activeSession && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '36px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{ fontSize: '48px' }}>🎯</span>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', margin: '8px 0 4px' }}>
              Test Session Completed
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              {activeSession.title}
            </p>
          </div>

          {/* Metric Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}>
            <MetricBox label="NEET PG Score" value={`${activeSession.score} pts`} color="#2563EB" icon="🏆" sub="Correct (+4) / Wrong (-1)" />
            <MetricBox label="Accuracy" value={`${activeSession.accuracy_percentage}%`} color="#10B981" icon="🎯" sub={`${activeSession.correct_count} of ${activeSession.total_questions}`} />
            <MetricBox label="Correct Answers" value={`${activeSession.correct_count}`} color="#059669" icon="✓" sub="+4 marks each" />
            <MetricBox label="Incorrect Answers" value={`${activeSession.incorrect_count}`} color="#DC2626" icon="✕" sub="-1 mark each" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <button
              onClick={() => {
                setCurrentQIndex(0);
                setSubView('solving');
              }}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📖 Review All Questions & Explanations
            </button>
            <button
              onClick={() => setSubView('attempted')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🎯 Go to Attempted Questions
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. CUSTOM TEST GENERATOR                                       */}
      {/* ============================================================== */}
      {subView === 'generator' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '32px',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            ⚡ Custom NEET PG Test Generator
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
            Create targeted subject combinations, multi-subject grand drills, or difficulty-specific test sessions without duplicate questions.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Test Session Name
              </label>
              <input
                type="text"
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                Select Subjects (Pick multiple or leave unselected for all 19 subjects)
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '12px',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
              }}>
                {subjects.map((s) => {
                  const isChecked = genSubjects.includes(s.id);
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setGenSubjects(genSubjects.filter((id) => id !== s.id));
                          } else {
                            setGenSubjects([...genSubjects, s.id]);
                          }
                        }}
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Question Count
                </label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value={10}>10 Questions (Quick Review)</option>
                  <option value={25}>25 Questions (Standard Practice)</option>
                  <option value={50}>50 Questions (Subject Test)</option>
                  <option value={100}>100 Questions (Mini-Grand)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Solving Mode
                </label>
                <select
                  value={genMode}
                  onChange={(e) => setGenMode(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="practice">Practice Mode (Instant Explanations)</option>
                  <option value="exam">Exam Mode (Timed + Concealed Explanations)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Difficulty
                </label>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <option value="">All Difficulties (Balanced)</option>
                  <option value="easy">Easy (Foundational)</option>
                  <option value="medium">Medium (Moderate)</option>
                  <option value="hard">Hard (High-Yield Clinical)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                onClick={handleLaunchCustomTest}
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🚀 Generate & Start Custom Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8. BOOKMARKS VIEW                                              */}
      {/* ============================================================== */}
      {subView === 'bookmarks' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '28px',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            ⭐ Bookmarked Revision MCQs
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
            All high-yield questions saved during practice sessions for quick high-yield revision.
          </p>

          {bookmarks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
              <span style={{ fontSize: '40px' }}>🔖</span>
              <p style={{ marginTop: '12px', fontSize: '15px' }}>No bookmarked questions yet.</p>
              <p style={{ fontSize: '13px' }}>Click "Bookmark" during question practice to save important MCQs here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {bookmarks.map((b) => (
                <div key={b.id} style={{
                  padding: '20px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}
                    dangerouslySetInnerHTML={{ __html: formatMedicalHtml(b.question.html_content || b.question.text) }}
                  />
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748B' }}>
                    <span>ID: #{b.question_id}</span>
                    <span>Saved: {new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 9. ANALYTICS VIEW                                              */}
      {/* ============================================================== */}
      {subView === 'analytics' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '32px',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            📊 Student Performance & Accuracy Analytics
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
            Real-time metrics calculated from your actual question attempts and test submissions.
          </p>

          {analytics ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <MetricBox label="Total Questions Attempted" value={`${analytics.total_attempted}`} color="#2563EB" icon="📝" />
                <MetricBox label="Overall Accuracy" value={`${analytics.overall_accuracy}%`} color="#10B981" icon="🎯" />
                <MetricBox label="Total Correct" value={`${analytics.total_correct}`} color="#059669" icon="✓" />
                <MetricBox label="Total Incorrect" value={`${analytics.total_incorrect}`} color="#DC2626" icon="✕" />
              </div>

              {analytics.weak_subjects && analytics.weak_subjects.length > 0 && (
                <div style={{
                  padding: '16px 20px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  borderRadius: '8px',
                  color: '#92400E',
                  marginBottom: '24px',
                }}>
                  <strong>Recommended Revision Focus:</strong> Your accuracy in {analytics.weak_subjects.join(', ')} is currently below 60%. Prioritize these subjects in your custom test sessions!
                </div>
              )}

              {/* Subject Breakdown List */}
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', marginBottom: '16px' }}>
                Subject-Wise Accuracy
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analytics.subject_breakdown.map((sb) => (
                  <div key={sb.code} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>{sb.subject}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#64748B' }}>
                        {sb.correct} / {sb.attempted} correct
                      </span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: sb.accuracy >= 70 ? '#ECFDF5' : sb.accuracy >= 50 ? '#FEF3C7' : '#FEF2F2',
                        color: sb.accuracy >= 70 ? '#059669' : sb.accuracy >= 50 ? '#B45309' : '#DC2626',
                      }}>
                        {sb.accuracy}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              No performance data recorded yet. Start practicing questions to see your metrics!
            </div>
          )}
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            padding: '24px',
          }}
        >
          <img
            src={zoomedImage}
            alt="Expanded Clinical Reference"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      )}
    </div>
  );
};

// Sub-component: Subject Card
interface SubjectCardProps {
  subject: SubjectItem;
  onViewTopics: () => void;
  onStart: () => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onViewTopics, onStart }) => {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E2E8F0',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '16px',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            {subject.name}
          </h4>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: '#F1F5F9',
            color: '#475569',
            padding: '2px 8px',
            borderRadius: '4px',
          }}>
            {subject.code}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: '#64748B' }}>
          {subject.total_questions.toLocaleString()} Medical MCQs
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onViewTopics}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span>📂 Topics Hub</span>
        </button>

        <button
          onClick={onStart}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: '#0D9488',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span>⚡ 15 Qs Drill</span>
        </button>
      </div>
    </div>
  );
};

// Sub-component: Problem Row
const ProblemRow: React.FC<{ p: QuestionItem; onSolve: () => void; showTopicBadge?: boolean }> = ({ p, onSolve, showTopicBadge }) => {
  const uStat = p.user_status;
  const isSolved = uStat && uStat.is_attempted && uStat.is_correct;
  const isIncorrect = uStat && uStat.is_attempted && !uStat.is_correct;

  return (
    <tr
      style={{
        borderBottom: '1px solid #F1F5F9',
        transition: 'background-color 0.1s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {/* Status Column */}
      <td style={{ padding: '14px' }}>
        {isSolved ? (
          <span style={{
            backgroundColor: '#ECFDF5',
            color: '#059669',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: 800,
            fontSize: '11px',
          }}>
            ✓ Solved
          </span>
        ) : isIncorrect ? (
          <span style={{
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: 800,
            fontSize: '11px',
          }}>
            ✕ Wrong
          </span>
        ) : (
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>○ Todo</span>
        )}
      </td>

      {/* Question Text */}
      <td style={{ padding: '14px' }}>
        <div
          style={{
            fontWeight: 600,
            color: '#0F172A',
            cursor: 'pointer',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          onClick={onSolve}
          dangerouslySetInnerHTML={{ __html: formatMedicalHtml(p.text || p.html_content) }}
        />
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
          {p.is_clinical && (
            <span style={{ fontSize: '10px', color: '#B45309', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '3px' }}>
              Clinical
            </span>
          )}
          {p.has_images && (
            <span style={{ fontSize: '10px', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '1px 6px', borderRadius: '3px' }}>
              🖼️ Image
            </span>
          )}
          {p.pyq_year && (
            <span style={{ fontSize: '10px', color: '#4338CA', backgroundColor: '#EEF2FF', padding: '1px 6px', borderRadius: '3px' }}>
              PYQ {p.pyq_year}
            </span>
          )}
        </div>
      </td>

      {/* Subject & Topic Badge */}
      {showTopicBadge && (
        <td style={{ padding: '14px', fontSize: '12px' }}>
          <div style={{ fontWeight: 600, color: '#334155' }}>
            {p.subject_name || `Subject #${p.subject_id}`}
          </div>
          {p.topic_name && (
            <div style={{
              display: 'inline-block',
              backgroundColor: '#F1F5F9',
              color: '#475569',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              marginTop: '2px',
            }}>
              📂 {p.topic_name}
            </div>
          )}
          {p.subtopic_name && (
            <div style={{
              display: 'inline-block',
              backgroundColor: '#EEF2FF',
              color: '#4338CA',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              marginTop: '2px',
              marginLeft: p.topic_name ? '4px' : '0',
            }}>
              📑 {p.subtopic_name}
            </div>
          )}
        </td>
      )}

      {/* Difficulty */}
      <td style={{ padding: '14px' }}>
        <span style={{
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: p.difficulty === 'easy' ? '#ECFDF5' : p.difficulty === 'medium' ? '#FEF3C7' : '#FEF2F2',
          color: p.difficulty === 'easy' ? '#059669' : p.difficulty === 'medium' ? '#D97706' : '#DC2626',
          textTransform: 'capitalize',
        }}>
          {p.difficulty}
        </span>
      </td>

      {/* Action */}
      <td style={{ padding: '14px', textAlign: 'right' }}>
        <button
          onClick={onSolve}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: isSolved ? '#F1F5F9' : isIncorrect ? '#DC2626' : '#2563EB',
            color: isSolved ? '#0F172A' : '#FFFFFF',
            border: isSolved ? '1px solid #CBD5E1' : 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isSolved ? 'Re-Solve' : isIncorrect ? 'Try Again' : 'Solve MCQ'}
        </button>
      </td>
    </tr>
  );
};

// Sub-component: Metric Box
const MetricBox: React.FC<{ label: string; value: string; color: string; icon: string; sub?: string }> = ({
  label,
  value,
  color,
  icon,
  sub,
}) => {
  return (
    <div style={{
      backgroundColor: '#F8FAFC',
      borderRadius: '10px',
      padding: '16px',
      border: '1px solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '16px' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: color }}>
        {value}
      </div>
      {sub && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{sub}</span>}
    </div>
  );
};
