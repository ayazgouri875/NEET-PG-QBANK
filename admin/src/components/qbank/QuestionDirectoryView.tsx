import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Image as ImageIcon,
  RotateCcw,
  Search,
  Star,
  X,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../../api';
import { QuestionItem, SubjectItem, TopicItem } from '../../types';
import { formatMedicalHtml } from './shared';

interface QuestionDirectoryViewProps {
  subjects: SubjectItem[];
  initialSubjectIds?: number[];
  initialTopicId?: number | '';
  initialSubtopicId?: number | '';
  onOpenQuestion: (q: QuestionItem) => void;
  onNotify: (type: 'error' | 'success' | 'info', message: string, onRetry?: () => void) => void;
}

export const QuestionDirectoryView: React.FC<QuestionDirectoryViewProps> = ({
  subjects,
  initialSubjectIds = [],
  initialTopicId = '',
  initialSubtopicId = '',
  onOpenQuestion,
  onNotify,
}) => {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unattempted' | 'solved' | 'incorrect' | 'bookmarked'>('all');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>(initialSubjectIds);
  const [topicId, setTopicId] = useState<number | ''>(initialTopicId);
  const [subtopicId, setSubtopicId] = useState<number | ''>(initialSubtopicId);
  const [difficulty, setDifficulty] = useState<string>('');
  const [isClinical, setIsClinical] = useState<boolean | undefined>(undefined);
  const [hasImages, setHasImages] = useState<boolean | undefined>(undefined);
  const [pyqYear, setPyqYear] = useState<number | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Metadata
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [pyqYears, setPyqYears] = useState<number[]>([]);
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const subjectDropdownRef = useRef<HTMLDivElement | null>(null);

  // Sync incoming initial filters when navigating from Topics Hub
  useEffect(() => {
    setSelectedSubjectIds(initialSubjectIds);
    setTopicId(initialTopicId);
    setSubtopicId(initialSubtopicId);
    setPage(1);
  }, [initialSubjectIds.join(','), initialTopicId, initialSubtopicId]);

  useEffect(() => {
    adminApi.fetchQuestionFiltersMeta().then((m) => setPyqYears(m.pyq_years || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(e.target as Node)) {
        setSubjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // 300ms debounced keyword search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Dependent Topic selector when single subject selected
  useEffect(() => {
    if (selectedSubjectIds.length === 1) {
      adminApi.fetchTopics(selectedSubjectIds[0]).then(setTopics).catch(() => setTopics([]));
    } else {
      setTopics([]);
      setTopicId('');
      setSubtopicId('');
    }
  }, [selectedSubjectIds.join(',')]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const res = await adminApi.fetchQuestions({
        page,
        page_size: pageSize,
        subject_ids: selectedSubjectIds.length > 0 ? selectedSubjectIds : undefined,
        topic_id: topicId !== '' ? Number(topicId) : undefined,
        subtopic_id: subtopicId !== '' ? Number(subtopicId) : undefined,
        difficulty: difficulty || undefined,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
        is_clinical: isClinical,
        has_images: hasImages,
        pyq_year: pyqYear !== '' ? Number(pyqYear) : undefined,
        q: debouncedSearch || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load questions', loadQuestions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [
    page,
    pageSize,
    statusFilter,
    selectedSubjectIds.join(','),
    topicId,
    subtopicId,
    difficulty,
    isClinical,
    hasImages,
    pyqYear,
    debouncedSearch,
  ]);

  const handleToggleRowBookmark = async (e: React.MouseEvent, q: QuestionItem) => {
    e.stopPropagation();
    try {
      const res = await adminApi.toggleBookmark(q.id);
      setItems((prev) =>
        prev.map((row) =>
          row.id === q.id
            ? {
                ...row,
                user_status: {
                  is_attempted: row.user_status?.is_attempted ?? false,
                  is_correct: row.user_status?.is_correct ?? false,
                  selected_option_index: row.user_status?.selected_option_index ?? null,
                  answered_at: row.user_status?.answered_at ?? null,
                  is_bookmarked: res.bookmarked,
                },
              }
            : row
        )
      );
    } catch (err: any) {
      onNotify('error', err.message || 'Could not update bookmark');
    }
  };

  const toggleSubjectId = (id: number) => {
    setPage(1);
    setTopicId('');
    setSubtopicId('');
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setSelectedSubjectIds([]);
    setTopicId('');
    setSubtopicId('');
    setDifficulty('');
    setIsClinical(undefined);
    setHasImages(undefined);
    setPyqYear('');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  };

  // Build removable active filter chips
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (statusFilter !== 'all') {
    activeChips.push({
      key: 'status',
      label: `Status: ${statusFilter}`,
      onRemove: () => { setStatusFilter('all'); setPage(1); },
    });
  }
  selectedSubjectIds.forEach((sid) => {
    const s = subjects.find((x) => x.id === sid);
    activeChips.push({
      key: `subj-${sid}`,
      label: s ? s.name : `Subject #${sid}`,
      onRemove: () => toggleSubjectId(sid),
    });
  });
  if (topicId !== '') {
    const t = topics.find((x) => x.id === Number(topicId));
    activeChips.push({
      key: 'topic',
      label: t ? `Topic: ${t.name}` : `Topic #${topicId}`,
      onRemove: () => { setTopicId(''); setSubtopicId(''); setPage(1); },
    });
  }
  if (subtopicId !== '') {
    activeChips.push({
      key: 'subtopic',
      label: `Subtopic #${subtopicId}`,
      onRemove: () => { setSubtopicId(''); setPage(1); },
    });
  }
  if (difficulty) {
    activeChips.push({
      key: 'diff',
      label: `Difficulty: ${difficulty}`,
      onRemove: () => { setDifficulty(''); setPage(1); },
    });
  }
  if (isClinical) {
    activeChips.push({
      key: 'clinical',
      label: 'Clinical Vignette',
      onRemove: () => { setIsClinical(undefined); setPage(1); },
    });
  }
  if (hasImages) {
    activeChips.push({
      key: 'images',
      label: 'Image-based',
      onRemove: () => { setHasImages(undefined); setPage(1); },
    });
  }
  if (pyqYear !== '') {
    activeChips.push({
      key: 'pyq',
      label: `PYQ ${pyqYear}`,
      onRemove: () => { setPyqYear(''); setPage(1); },
    });
  }
  if (debouncedSearch) {
    activeChips.push({
      key: 'q',
      label: `"${debouncedSearch}"`,
      onRemove: () => { setSearchInput(''); setDebouncedSearch(''); setPage(1); },
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sticky Filter Bar */}
      <div
        className="ui-card"
        style={{
          position: 'sticky',
          top: '76px',
          zIndex: 35,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Question Directory &bull; <span style={{ color: 'var(--primary)' }}>{total.toLocaleString()}</span> MCQs
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <label htmlFor="dir-pagesize">Per page:</label>
            <select
              id="dir-pagesize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={filterSelectStyle}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input (300ms Debounced) */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '180px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              aria-label="Search questions by keyword"
              placeholder="Search clinical keywords..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
            style={filterSelectStyle}
          >
            <option value="all">All statuses</option>
            <option value="unattempted">Unattempted</option>
            <option value="solved">Solved</option>
            <option value="incorrect">Incorrect</option>
            <option value="bookmarked">Bookmarked</option>
          </select>

          {/* Multi-Select Subject Popover */}
          <div ref={subjectDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="compact-tap"
              aria-expanded={subjectDropdownOpen}
              onClick={() => setSubjectDropdownOpen((o) => !o)}
              style={{
                ...filterSelectStyle,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <span>
                {selectedSubjectIds.length === 0
                  ? 'Subjects (All)'
                  : selectedSubjectIds.length === 1
                  ? subjects.find((s) => s.id === selectedSubjectIds[0])?.name || '1 Subject'
                  : `${selectedSubjectIds.length} Subjects`}
              </span>
              <ChevronDown size={14} />
            </button>

            {subjectDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '260px',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  zIndex: 60,
                }}
              >
                {subjects.map((s) => {
                  const checked = selectedSubjectIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        backgroundColor: checked ? 'var(--primary-soft)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubjectId(s.id)}
                      />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.code}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dependent Topic Dropdown */}
          <select
            aria-label="Filter by topic"
            value={topicId}
            disabled={selectedSubjectIds.length !== 1}
            onChange={(e) => {
              setTopicId(e.target.value ? Number(e.target.value) : '');
              setSubtopicId('');
              setPage(1);
            }}
            style={{
              ...filterSelectStyle,
              opacity: selectedSubjectIds.length === 1 ? 1 : 0.55,
              maxWidth: '200px',
            }}
          >
            <option value="">
              {selectedSubjectIds.length === 1 ? 'All Topics' : 'Select 1 subject for topics'}
            </option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Difficulty */}
          <select
            aria-label="Filter by difficulty"
            value={difficulty}
            onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
            style={filterSelectStyle}
          >
            <option value="">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* PYQ Year */}
          <select
            aria-label="Filter by PYQ year"
            value={pyqYear}
            onChange={(e) => { setPyqYear(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
            style={filterSelectStyle}
          >
            <option value="">All Years</option>
            {pyqYears.map((y) => (
              <option key={y} value={y}>PYQ {y}</option>
            ))}
          </select>

          {/* Quick Tag Filters */}
          <button
            type="button"
            className="compact-tap"
            onClick={() => { setIsClinical((v) => (v ? undefined : true)); setPage(1); }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: isClinical ? 'var(--primary)' : 'var(--bg-subtle)',
              color: isClinical ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${isClinical ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            Clinical
          </button>

          <button
            type="button"
            className="compact-tap"
            onClick={() => { setHasImages((v) => (v ? undefined : true)); setPage(1); }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: hasImages ? 'var(--primary)' : 'var(--bg-subtle)',
              color: hasImages ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${hasImages ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            <ImageIcon size={13} />
            <span>Image-based</span>
          </button>
        </div>

        {/* Removable Active Filter Chips */}
        {activeChips.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  className="compact-tap"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={chip.onRemove}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="compact-tap"
              onClick={clearAllFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                marginLeft: '4px',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Table / Results */}
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="skeleton" style={{ height: '54px' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <Search size={36} style={{ color: 'var(--text-neutral)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              No questions match these filters
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Try removing a tag, clearing your keyword, or broadening your subject selection.
            </p>
            <button type="button" className="btn btn-teal" onClick={clearAllFilters}>
              <RotateCcw size={14} />
              <span>Clear all filters</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}>Status</th>
                  <th>Question &amp; Tags</th>
                  <th style={{ width: '240px' }}>Curriculum</th>
                  <th style={{ width: '96px' }}>Difficulty</th>
                  <th style={{ width: '56px', textAlign: 'center' }}>Save</th>
                </tr>
              </thead>
              <tbody>
                {items.map((q) => {
                  const u = q.user_status;
                  const isSolved = u?.is_attempted && u.is_correct;
                  const isWrong = u?.is_attempted && !u.is_correct;
                  const isBookmarked = !!u?.is_bookmarked;

                  const crumbs = [q.subject_name, q.topic_name, q.subtopic_name].filter(
                    (part, idx, arr) => Boolean(part) && (idx === 0 || part !== arr[idx - 1])
                  );

                  return (
                    <tr
                      key={q.id}
                      onClick={() => onOpenQuestion(q)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenQuestion(q);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Status Icon */}
                      <td style={{ textAlign: 'center' }}>
                        {isSolved ? (
                          <span title="Solved correctly" style={{ color: 'var(--success)', display: 'inline-flex' }}>
                            <CheckCircle2 size={18} />
                          </span>
                        ) : isWrong ? (
                          <span title="Incorrect attempt" style={{ color: 'var(--danger)', display: 'inline-flex' }}>
                            <XCircle size={18} />
                          </span>
                        ) : (
                          <span title="Unattempted" style={{ color: 'var(--text-neutral)', display: 'inline-flex' }}>
                            <Circle size={18} />
                          </span>
                        )}
                      </td>

                      {/* Question Stem + Clickable Tag Chips */}
                      <td>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.45,
                          }}
                          dangerouslySetInnerHTML={{ __html: formatMedicalHtml(q.text || q.html_content) }}
                        />
                        {(q.is_clinical || q.has_images || q.pyq_year) && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                            {q.is_clinical && (
                              <button
                                type="button"
                                className="compact-tap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsClinical(true);
                                  setPage(1);
                                }}
                                style={tagChipStyle}
                              >
                                Clinical
                              </button>
                            )}
                            {q.has_images && (
                              <button
                                type="button"
                                className="compact-tap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHasImages(true);
                                  setPage(1);
                                }}
                                style={tagChipStyle}
                              >
                                Image
                              </button>
                            )}
                            {q.pyq_year && (
                              <button
                                type="button"
                                className="compact-tap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPyqYear(q.pyq_year!);
                                  setPage(1);
                                }}
                                style={tagChipStyle}
                              >
                                PYQ {q.pyq_year}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Compact Single-Line Breadcrumb */}
                      <td>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '240px',
                        }}
                          title={crumbs.join(' › ')}
                        >
                          {crumbs.join(' › ')}
                        </div>
                      </td>

                      {/* Difficulty */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}>
                          {q.difficulty}
                        </span>
                      </td>

                      {/* Bookmark Star */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="compact-tap"
                          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                          onClick={(e) => handleToggleRowBookmark(e, q)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isBookmarked ? '#F59E0B' : 'var(--text-neutral)',
                            padding: '6px',
                            display: 'inline-flex',
                          }}
                        >
                          <Star size={17} fill={isBookmarked ? '#F59E0B' : 'none'} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'var(--bg-subtle)',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {total.toLocaleString()} MCQs
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline compact-tap"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ padding: '6px 12px', opacity: page <= 1 ? 0.5 : 1 }}
            >
              <ChevronLeft size={15} />
              <span>Previous</span>
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', padding: '0 6px' }}>
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <button
              type="button"
              className="btn btn-outline compact-tap"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '6px 12px', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              <span>Next</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const filterSelectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-main)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontWeight: 600,
};

const tagChipStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-subtle)',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
};
