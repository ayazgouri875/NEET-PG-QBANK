import React, { useEffect, useState } from 'react';
import { TopicsHubView } from '../components/qbank/TopicsHubView';
import { QuestionDirectoryView } from '../components/qbank/QuestionDirectoryView';
import { SolverView, SolverSummaryView, clearPersistedSolverState } from '../components/qbank/SolverView';
import { AttemptedView } from '../components/qbank/AttemptedView';
import { AnalyticsView, BookmarksView, CustomTestView } from '../components/qbank/AnalyticsBookmarksCustomViews';
import { ToastContainer, ToastMessage } from '../components/qbank/shared';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Flame,
  FlaskConical,
  HeartPulse,
  ListChecks,
  Microscope,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Target,
  Zap,
} from 'lucide-react';
import { adminApi } from '../api';
import { NavSection } from '../components/Sidebar';
import {
  AttemptedQuestionItem,
  AttemptedQuestionsStats,
  BookmarkItem,
  QuestionItem,
  StudentAnalytics,
  StudySummary,
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

interface StudentPracticeProps {
  externalSection?: NavSection;
  onSectionChange?: (section: NavSection) => void;
}

export const StudentPractice: React.FC<StudentPracticeProps> = ({
  externalSection,
  onSectionChange,
}) => {
  // Navigation views: 'curriculum' | 'topics' | 'problems' | 'attempted' | 'solving' | 'summary' | 'generator' | 'bookmarks' | 'analytics'
  const [subView, setSubView] = useState<'curriculum' | 'topics' | 'problems' | 'attempted' | 'solving' | 'summary' | 'generator' | 'bookmarks' | 'analytics'>('curriculum');

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [studySummary, setStudySummary] = useState<StudySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: Subjects Home Search, Filters & Collapsible Phases
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'in_progress' | 'not_started'>('all');
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});

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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [dirInitialSubjectIds, setDirInitialSubjectIds] = useState<number[]>([]);
  const [dirInitialTopicId, setDirInitialTopicId] = useState<number | ''>('');
  const [dirInitialSubtopicId, setDirInitialSubtopicId] = useState<number | ''>('');

  const notify = (type: 'error' | 'success' | 'info', message: string, onRetry?: () => void) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-3), { id, type, message, onRetry }]);
  };

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load Subjects & study summary on mount
  useEffect(() => {
    loadSubjects();
  }, []);

  // Sync sidebar / mobile bottom navigation selection with internal subView
  useEffect(() => {
    if (!externalSection || externalSection === 'categories') return;
    if (externalSection === 'subjects') {
      if (subView !== 'curriculum' && subView !== 'topics') {
        setSubView('curriculum');
        loadSubjects();
      }
    } else if (externalSection === 'bookmarks') {
      openBookmarks();
    } else if (externalSection === 'analytics') {
      openAnalytics();
    } else if (externalSection !== subView) {
      setSubView(externalSection);
    }
  }, [externalSection]);

  const navigateToSubView = (next: typeof subView) => {
    setSubView(next);
    if (!onSectionChange) return;
    if (next === 'curriculum' || next === 'topics') onSectionChange('subjects');
    else if (next === 'problems') onSectionChange('problems');
    else if (next === 'attempted') onSectionChange('attempted');
    else if (next === 'generator') onSectionChange('generator');
    else if (next === 'bookmarks') onSectionChange('bookmarks');
    else if (next === 'analytics') onSectionChange('analytics');
  };

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

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('neetpg_active_solver_v1');
      if (raw) {
        const parsed = JSON.parse(raw) as { sessionId?: number };
        if (parsed.sessionId && parsed.sessionId > 0) {
          void resumeActiveSession(parsed.sessionId);
        }
      }
    } catch {
      // ignore invalid session storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const [list, summary] = await Promise.all([
        adminApi.fetchSubjects(),
        adminApi.fetchStudySummary().catch(() => null),
      ]);
      setSubjects(list);
      if (summary) setStudySummary(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  const resumeActiveSession = async (sessionId: number) => {
    try {
      setLoading(true);
      const fullSession = await adminApi.fetchTestSession(sessionId);
      setActiveSession(fullSession);
      setCurrentQIndex(0);
      setAnswers({});
      setTimerSeconds(0);
      setIsTimerRunning(fullSession.test_mode === 'exam');
      setSubView('solving');
    } catch (err: any) {
      setError(err.message || 'Could not resume previous session');
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
      clearPersistedSolverState();
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
      clearPersistedSolverState();
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
      clearPersistedSolverState();
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
      notify('success', res.bookmarked ? 'Question bookmarked.' : 'Bookmark removed.');
    } catch (err: any) {
      notify('error', err.message || 'Bookmark toggle failed');
    }
  };

  const refreshBookmarks = async (subjectId?: number) => {
    try {
      setLoading(true);
      const list = await adminApi.fetchBookmarks(subjectId);
      setBookmarks(list);
      const bMap: Record<number, boolean> = {};
      list.forEach((b) => {
        bMap[b.question_id] = true;
      });
      setBookmarkedMap((prev) => ({ ...prev, ...bMap }));
    } catch (err: any) {
      notify('error', err.message || 'Could not load bookmarks', () => void refreshBookmarks(subjectId));
    } finally {
      setLoading(false);
    }
  };

  const solveQuestionById = async (questionId: number) => {
    await solveSingleQuestion({ id: questionId } as QuestionItem);
  };

  const openDirectoryFromTopics = (subjectId: number, topicId?: number, subtopicId?: number) => {
    setDirInitialSubjectIds([subjectId]);
    setDirInitialTopicId(topicId ?? '');
    setDirInitialSubtopicId(subtopicId ?? '');
    setSubView('problems');
  };

  const startQuestionIdsDrill = async (questionIds: number[], title: string) => {
    if (!questionIds.length) return;
    try {
      setLoading(true);
      const session = await adminApi.createCustomTest({
        title,
        test_type: 'custom',
        test_mode: 'practice',
        question_ids: questionIds,
        question_count: questionIds.length,
        is_timed: false,
      });
      const fullSession = await adminApi.fetchTestSession(session.id);
      clearPersistedSolverState();
      setActiveSession(fullSession);
      setSubView('solving');
    } catch (err: any) {
      notify('error', err.message || 'Could not start drill');
    } finally {
      setLoading(false);
    }
  };

  const startReattemptAllIncorrect = async () => {
    try {
      setLoading(true);
      const session = await adminApi.createCustomTest({
        title: 'Incorrect Questions Review Drill',
        test_type: 'custom',
        test_mode: 'practice',
        filter_status: 'wrong',
        question_count: 25,
        is_timed: false,
      });
      const fullSession = await adminApi.fetchTestSession(session.id);
      clearPersistedSolverState();
      setActiveSession(fullSession);
      setSubView('solving');
    } catch (err: any) {
      notify('error', err.message || 'Could not start incorrect questions drill');
    } finally {
      setLoading(false);
    }
  };

  const launchCustomTestV2 = async (config: {
    title: string;
    subject_ids: number[];
    topic_ids: number[];
    question_count: number;
    test_mode: 'practice' | 'exam';
    difficulty?: string;
    filter_status?: string;
  }) => {
    try {
      setLoading(true);
      const session = await adminApi.createCustomTest({
        title: config.title,
        test_type: 'custom',
        test_mode: config.test_mode,
        subject_ids: config.subject_ids.length > 0 ? config.subject_ids : undefined,
        topic_ids: config.topic_ids.length > 0 ? config.topic_ids : undefined,
        question_count: config.question_count,
        is_timed: config.test_mode === 'exam',
        duration_minutes: config.test_mode === 'exam' ? config.question_count : undefined,
        difficulty: config.difficulty,
        filter_status: config.filter_status,
      });
      const fullSession = await adminApi.fetchTestSession(session.id);
      clearPersistedSolverState();
      setActiveSession(fullSession);
      setSubView('solving');
    } catch (err: any) {
      notify('error', err.message || 'Could not generate custom test');
    } finally {
      setLoading(false);
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
      clearPersistedSolverState();
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

  const normalizeCategory = (cat?: string) => (cat || '').toLowerCase().replace(/[^a-z]/g, '');

  const filteredSubjects = subjects.filter((s) => {
    const q = subjectSearch.trim().toLowerCase();
    if (q && !s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) {
      return false;
    }
    const attempted = s.user_progress?.attempted || 0;
    if (subjectFilter === 'in_progress' && attempted === 0) return false;
    if (subjectFilter === 'not_started' && attempted > 0) return false;
    return true;
  });

  const preClinical = filteredSubjects.filter((s) => normalizeCategory(s.category) === 'preclinical');
  const paraClinical = filteredSubjects.filter((s) => normalizeCategory(s.category) === 'paraclinical');
  const clinical = filteredSubjects.filter((s) => normalizeCategory(s.category) === 'clinical');
  const otherSubjects = filteredSubjects.filter(
    (s) => !['preclinical', 'paraclinical', 'clinical'].includes(normalizeCategory(s.category))
  );

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
      {/* Top Sub-View Navigation */}
      <div
        className="ui-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            flexShrink: 0,
          }}>
            <Stethoscope size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Student Question Bank
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              19,225 clinical MCQs across 19 subjects and 283 topics
            </span>
          </div>
        </div>

        {/* Scrollable Sub-View Navigation Tabs */}
        <div
          className="horizontal-scroll-row"
          role="tablist"
          aria-label="Question bank sections"
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            width: '100%',
            maxWidth: '100%',
            padding: '2px 0',
          }}
        >
          {[
            {
              id: 'curriculum' as const,
              active: subView === 'curriculum' || subView === 'topics',
              label: 'Subjects & Topics',
              icon: <BookOpen size={15} />,
              onClick: () => navigateToSubView('curriculum'),
            },
            {
              id: 'problems' as const,
              active: subView === 'problems',
              label: 'Question Directory',
              icon: <ListChecks size={15} />,
              onClick: () => navigateToSubView('problems'),
            },
            {
              id: 'attempted' as const,
              active: subView === 'attempted',
              label: 'Attempted Q&A',
              icon: <Target size={15} />,
              onClick: () => navigateToSubView('attempted'),
            },
            {
              id: 'generator' as const,
              active: subView === 'generator',
              label: 'Custom Test',
              icon: <SlidersHorizontal size={15} />,
              onClick: () => navigateToSubView('generator'),
            },
            {
              id: 'bookmarks' as const,
              active: subView === 'bookmarks',
              label: 'Bookmarks',
              icon: <Bookmark size={15} />,
              onClick: () => {
                if (onSectionChange) onSectionChange('bookmarks');
                openBookmarks();
              },
            },
            {
              id: 'analytics' as const,
              active: subView === 'analytics',
              label: 'Analytics',
              icon: <BarChart3 size={15} />,
              onClick: () => {
                if (onSectionChange) onSectionChange('analytics');
                openAnalytics();
              },
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.active}
              onClick={tab.onClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: tab.active ? 'var(--primary)' : 'var(--bg-subtle)',
                color: tab.active ? '#FFFFFF' : 'var(--text-secondary)',
                border: tab.active ? '1px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
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

      {/* 1. TOPICS HUB (PHASE 2) */}
      {subView === 'topics' && selectedSubjectForTopics && (
        <TopicsHubView
          subject={selectedSubjectForTopics}
          topics={subjectTopics}
          loading={topicsLoading}
          onBackToSubjects={() => navigateToSubView('curriculum')}
          onStartSubjectDrill={(sid, sname) => void startSubjectPractice(sid, sname)}
          onStartTopicDrill={(sid, tid, tname) => void startTopicPractice(sid, tid, tname)}
          onStartSubtopicDrill={(sid, tid, stid, stname) => void startSubtopicPractice(sid, tid, stid, stname)}
          onViewQuestions={(sid, tid, stid) => openDirectoryFromTopics(sid, tid, stid)}
        />
      )}

      {/* 2. QUESTION DIRECTORY (PHASE 3) */}
      {subView === 'problems' && (
        <QuestionDirectoryView
          subjects={subjects}
          initialSubjectIds={dirInitialSubjectIds}
          initialTopicId={dirInitialTopicId}
          initialSubtopicId={dirInitialSubtopicId}
          onOpenQuestion={(q) => void solveSingleQuestion(q)}
          onNotify={notify}
        />
      )}

      {/* 3. ATTEMPTED QUESTIONS (PHASE 5) */}
      {subView === 'attempted' && (
        <AttemptedView
          subjects={subjects}
          bookmarkedMap={bookmarkedMap}
          onToggleBookmark={handleToggleBookmark}
          onReattemptQuestion={(qid) => void solveQuestionById(qid)}
          onReattemptAllIncorrect={() => void startReattemptAllIncorrect()}
          onBrowseDirectory={() => navigateToSubView('problems')}
          onNotify={notify}
        />
      )}

      {/* ============================================================== */}
      {/* 4. CURRICULUM VIEW (19 SUBJECTS - PHASE 1)                     */}
      {/* ============================================================== */}
      {subView === 'curriculum' && (() => {
        const cont = studySummary?.continue_from || null;
        const dailySolved = studySummary?.daily_goal?.solved_today || 0;
        const dailyAttempted = studySummary?.daily_goal?.attempted_today || 0;
        const dailyTarget = studySummary?.daily_goal?.target || 30;
        const dailyPct = Math.min(100, Math.round((dailyAttempted / dailyTarget) * 100));
        const streakDays = studySummary?.streak_days || 0;

        const phaseSections = [
          {
            key: 'preclinical',
            title: 'Pre-Clinical (Phase I)',
            icon: <Microscope size={18} style={{ color: 'var(--primary)' }} />,
            items: preClinical,
          },
          {
            key: 'paraclinical',
            title: 'Para-Clinical (Phase II)',
            icon: <FlaskConical size={18} style={{ color: 'var(--primary)' }} />,
            items: paraClinical,
          },
          {
            key: 'clinical',
            title: 'Clinical (Phase III & IV)',
            icon: <HeartPulse size={18} style={{ color: 'var(--primary)' }} />,
            items: [...clinical, ...otherSubjects],
          },
        ];

        const togglePhase = (key: string) => {
          setCollapsedPhases((prev) => ({ ...prev, [key]: !prev[key] }));
        };

        if (loading && subjects.length === 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div className="skeleton" style={{ height: '132px', borderRadius: '12px' }} />
                <div className="skeleton" style={{ height: '132px', borderRadius: '12px' }} />
              </div>
              <div className="skeleton" style={{ height: '48px', borderRadius: '12px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '16px' }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="skeleton" style={{ height: '164px', borderRadius: '12px' }} />
                ))}
              </div>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Study Row: Continue Where You Left Off + Daily Goal & Streak */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '16px',
            }}>
              {/* Continue Where You Left Off / Start First Drill */}
              <div
                className="ui-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                {cont ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--primary)',
                          marginBottom: '6px',
                        }}>
                          Continue where you left off
                        </span>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                          {cont.subject_name}
                          {cont.topic_name ? ` — ${cont.topic_name}` : ''}
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                          {cont.questions_solved.toLocaleString()} of {cont.total_subject_questions.toLocaleString()} MCQs solved in {cont.subject_name}
                        </p>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }}>
                        {cont.subject_code}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-teal"
                        onClick={() => {
                          if (cont.active_session_id) {
                            resumeActiveSession(cont.active_session_id);
                          } else {
                            const matchedSubj = subjects.find((s) => s.id === cont.subject_id);
                            if (matchedSubj) {
                              openSubjectTopics(matchedSubj);
                            } else {
                              startSubjectPractice(cont.subject_id, cont.subject_name);
                            }
                          }
                        }}
                      >
                        <Play size={15} />
                        <span>Resume</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => startSubjectPractice(cont.subject_id, cont.subject_name)}
                      >
                        <Zap size={15} />
                        <span>Quick Drill (15)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--primary)',
                        marginBottom: '6px',
                      }}>
                        Ready to begin
                      </span>
                      <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Start your first drill
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                        Pick any subject below or launch a quick 15-question practice drill.
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn btn-teal"
                        disabled={subjects.length === 0}
                        onClick={() => {
                          const first = preClinical[0] || subjects[0];
                          if (first) startSubjectPractice(first.id, first.name);
                        }}
                      >
                        <Play size={15} />
                        <span>Start First Drill</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Daily Goal & Study Streak Widget */}
              <div
                className="ui-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                    }}>
                      Daily Goal
                    </span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {dailyAttempted} / {dailyTarget} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>questions today</span>
                    </div>
                  </div>

                  {/* Study Streak Pill */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    backgroundColor: streakDays > 0 ? 'var(--primary-soft)' : 'var(--bg-subtle)',
                    color: streakDays > 0 ? 'var(--primary)' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    <Flame size={16} />
                    <span>{streakDays} day{streakDays === 1 ? '' : 's'} streak</span>
                  </div>
                </div>

                <div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--bg-subtle)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${dailyPct}%`,
                      height: '100%',
                      borderRadius: '999px',
                      backgroundColor: dailyAttempted > 0 ? 'var(--primary)' : 'var(--text-neutral)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                  }}>
                    <span>{dailySolved} correct today</span>
                    <span>{dailyPct}% of daily target</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject Search & Filter Chips */}
            <div
              className="ui-card"
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  aria-label="Search subjects"
                  placeholder="Search subjects by name or code (e.g. Anatomy, MED)..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all' as const, label: `All (${subjects.length})` },
                  {
                    id: 'in_progress' as const,
                    label: `In progress (${subjects.filter((s) => (s.user_progress?.attempted || 0) > 0).length})`,
                  },
                  {
                    id: 'not_started' as const,
                    label: `Not started (${subjects.filter((s) => (s.user_progress?.attempted || 0) === 0).length})`,
                  },
                ].map((chip) => {
                  const active = subjectFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      className="compact-tap"
                      onClick={() => setSubjectFilter(chip.id)}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: active ? 'var(--primary)' : 'var(--bg-subtle)',
                        color: active ? '#FFFFFF' : 'var(--text-secondary)',
                        border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Empty State when filtered */}
            {filteredSubjects.length === 0 ? (
              <div
                className="ui-card"
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <BookOpen size={36} style={{ color: 'var(--text-neutral)' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  No subjects match your current filter
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  Try clearing your search term or switching back to all 19 NEET PG subjects.
                </p>
                <button
                  type="button"
                  className="btn btn-teal"
                  onClick={() => {
                    setSubjectSearch('');
                    setSubjectFilter('all');
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Reset filters</span>
                </button>
              </div>
            ) : (
              /* Ordered Collapsible Phase Sections: Pre-Clinical, Para-Clinical, Clinical */
              phaseSections.map((section) => {
                if (section.items.length === 0) return null;
                const isCollapsed = !!collapsedPhases[section.key];
                const sectionSolved = section.items.reduce((acc, s) => acc + (s.user_progress?.solved || 0), 0);
                const sectionTotal = section.items.reduce((acc, s) => acc + s.total_questions, 0);

                return (
                  <section key={section.key} aria-label={section.title}>
                    <button
                      type="button"
                      onClick={() => togglePhase(section.key)}
                      aria-expanded={!isCollapsed}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 4px',
                        marginBottom: isCollapsed ? '0' : '12px',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        {section.icon}
                        <h3 style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                          letterSpacing: '0.02em',
                        }}>
                          {section.title}
                        </h3>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}>
                          {section.items.length} subjects
                        </span>
                      </div>

                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {sectionSolved.toLocaleString()} / {sectionTotal.toLocaleString()} solved
                      </span>
                    </button>

                    {!isCollapsed && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                        gap: '16px',
                      }}>
                        {section.items.map((s) => (
                          <SubjectCard
                            key={s.id}
                            subject={s}
                            onViewTopics={() => openSubjectTopics(s)}
                            onStart={() => startSubjectPractice(s.id, s.name)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        );
      })()}

      {/* 5. MCQ SOLVER (PHASE 4) */}
      {subView === 'solving' && activeSession && activeSession.questions && activeSession.questions.length > 0 && (
        <SolverView
          session={activeSession}
          bookmarkedMap={bookmarkedMap}
          onToggleBookmark={handleToggleBookmark}
          onSessionUpdated={(s) => setActiveSession(s)}
          onFinishSession={(completed) => {
            setActiveSession(completed);
            setSubView('summary');
          }}
          onExit={() => {
            clearPersistedSolverState();
            navigateToSubView('curriculum');
          }}
          onNotify={notify}
        />
      )}

      {/* 6. TEST SUMMARY (PHASE 4) */}
      {subView === 'summary' && activeSession && (
        <SolverSummaryView
          session={activeSession}
          onReattemptWrong={(ids, title) => void startQuestionIdsDrill(ids, title)}
          onBackToSubjects={() => navigateToSubView('curriculum')}
          onReviewAttempted={() => navigateToSubView('attempted')}
        />
      )}

      {/* 7. CUSTOM TEST GENERATOR (PHASE 6) */}
      {subView === 'generator' && (
        <CustomTestView
          subjects={subjects}
          onStartTest={launchCustomTestV2}
        />
      )}

      {/* 8. BOOKMARKS VIEW (PHASE 6) */}
      {subView === 'bookmarks' && (
        <BookmarksView
          subjects={subjects}
          bookmarks={bookmarks}
          loading={loading}
          onRefresh={refreshBookmarks}
          onRemoveBookmark={async (qid) => {
            await handleToggleBookmark(qid);
            await refreshBookmarks();
          }}
          onSolveQuestion={(qid) => void solveQuestionById(qid)}
          onPracticeBookmarked={(ids) => void startQuestionIdsDrill(ids, 'Bookmarked Revision Drill')}
          onBrowseDirectory={() => navigateToSubView('problems')}
          onNotify={notify}
        />
      )}

      {/* 9. ANALYTICS VIEW (PHASE 6) */}
      {subView === 'analytics' && (
        <AnalyticsView
          analytics={analytics}
          loading={loading}
          onPracticeWeakTopic={(sid, tid, tname) => void startTopicPractice(sid, tid, tname)}
          onBrowseSubjects={() => navigateToSubView('curriculum')}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// Sub-component: Subject Card (Whole card clickable -> Topics Hub, one secondary Quick Drill button)
interface SubjectCardProps {
  subject: SubjectItem;
  onViewTopics: () => void;
  onStart: () => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onViewTopics, onStart }) => {
  const prog = subject.user_progress;
  const attempted = prog?.attempted || 0;
  const solved = prog?.solved || 0;
  const accuracy = prog?.accuracy_percentage || 0;
  const pct = subject.total_questions > 0
    ? Math.min(100, Math.round((solved / subject.total_questions) * 100))
    : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewTopics}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewTopics();
        }
      }}
      aria-label={`Open ${subject.name} topics hub`}
      className="ui-card ui-card-interactive"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
        cursor: 'pointer',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {subject.name}
          </h4>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-secondary)',
            padding: '2px 8px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {subject.code}
          </span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginBottom: '10px',
        }}>
          <span>{subject.total_questions.toLocaleString()} MCQs</span>
          {attempted > 0 ? (
            <span style={{
              fontWeight: 700,
              color: accuracy >= 50 ? 'var(--success)' : 'var(--danger)',
            }}>
              {accuracy}% accuracy
            </span>
          ) : (
            <span style={{ color: 'var(--text-neutral)', fontWeight: 500 }}>
              Not started
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '6px',
          borderRadius: '999px',
          backgroundColor: 'var(--bg-subtle)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: '999px',
            backgroundColor: solved > 0 ? 'var(--primary)' : 'var(--text-neutral)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginTop: '6px',
        }}>
          <span>{solved.toLocaleString()} / {subject.total_questions.toLocaleString()} solved</span>
          <span>{pct}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--primary)',
        }}>
          <span>Explore topics</span>
          <ArrowRight size={14} />
        </span>

        <button
          type="button"
          className="compact-tap"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Zap size={13} style={{ color: 'var(--primary)' }} />
          <span>Quick Drill (15)</span>
        </button>
      </div>
    </div>
  );
};

