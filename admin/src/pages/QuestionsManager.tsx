import React, { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { QuestionEditModal } from '../components/QuestionEditModal';
import { QuestionItem, SubjectItem } from '../types';

export const QuestionsManager: React.FC = () => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [difficulty, setDifficulty] = useState<string | undefined>();
  const [isClinical, setIsClinical] = useState<boolean | undefined>();
  const [hasImages, setHasImages] = useState<boolean | undefined>();

  // Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [page, selectedSubject, difficulty, isClinical, hasImages]);

  const loadSubjects = async () => {
    try {
      const data = await adminApi.fetchSubjects();
      setSubjects(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await adminApi.fetchQuestions({
        page,
        page_size: 20,
        subject_id: selectedSubject,
        difficulty,
        is_clinical: isClinical,
        has_images: hasImages,
        q: searchQuery || undefined,
      });
      setQuestions(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadQuestions();
  };

  const handleDeactivate = async (qId: number) => {
    if (confirm(`Are you sure you want to soft deactivate Question #${qId}?`)) {
      try {
        await adminApi.deactivateQuestion(qId);
        loadQuestions();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleOpenEdit = async (q: QuestionItem) => {
    try {
      // Fetch full question with explanation
      const full = await adminApi.fetchQuestionDetail(q.id);
      setEditingQuestion(full);
    } catch {
      setEditingQuestion(q);
    }
  };

  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 32px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filter Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search questions by medical keywords (e.g. Vecuronium, ST elevation, Morula)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '14px',
            }}
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Subject Filter */}
          <select
            value={selectedSubject || ''}
            onChange={(e) => {
              setSelectedSubject(e.target.value ? parseInt(e.target.value) : undefined);
              setPage(1);
            }}
            style={filterSelectStyle}
          >
            <option value="">All 19 Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.total_questions})
              </option>
            ))}
          </select>

          {/* Difficulty Filter */}
          <select
            value={difficulty || ''}
            onChange={(e) => {
              setDifficulty(e.target.value || undefined);
              setPage(1);
            }}
            style={filterSelectStyle}
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* Clinical Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isClinical === true}
              onChange={(e) => {
                setIsClinical(e.target.checked ? true : undefined);
                setPage(1);
              }}
            />
            🩺 Clinical Scenarios Only
          </label>

          {/* Image Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hasImages === true}
              onChange={(e) => {
                setHasImages(e.target.checked ? true : undefined);
                setPage(1);
              }}
            />
            🖼️ Image-Based Only
          </label>

          <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
            {total.toLocaleString()} Matching MCQs
          </span>
        </div>
      </div>

      {/* Questions Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading questions...</div>
        ) : questions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>No questions match your search criteria.</div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>ID</th>
                  <th style={{ width: '110px' }}>MCQ ID</th>
                  <th>Question Prompt Text</th>
                  <th style={{ width: '130px' }}>Type</th>
                  <th style={{ width: '90px' }}>Options</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600, color: '#64748B' }}>#{q.id}</td>
                    <td>
                      <span className="badge badge-primary">{q.mcq_id || 'N/A'}</span>
                    </td>
                    <td>
                      <div style={{
                        fontWeight: 500,
                        maxHeight: '44px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {q.text}
                      </div>
                    </td>
                    <td>
                      {q.is_clinical && <span className="badge badge-teal" style={{ marginRight: '4px' }}>Clinical</span>}
                      {q.has_images && <span className="badge badge-purple">Images</span>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{q.options.length} Opts</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenEdit(q)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeactivate(q.id)}
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
        }}>
          <span style={{ fontSize: '13px', color: '#64748B' }}>
            Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} of {total.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 600, padding: '0 8px' }}>
              Page {page} of {Math.ceil(total / 20) || 1}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= Math.ceil(total / 20)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingQuestion && (
        <QuestionEditModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={() => loadQuestions()}
        />
      )}
    </div>
  );
};

const filterSelectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  fontSize: '13px',
  backgroundColor: '#FFFFFF',
};

