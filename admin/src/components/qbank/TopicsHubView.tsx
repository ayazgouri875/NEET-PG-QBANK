import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderOpen,
  ListChecks,
  RotateCcw,
  Search,
  Zap,
} from 'lucide-react';
import { SubjectItem, TopicItem } from '../../types';

interface TopicsHubViewProps {
  subject: SubjectItem;
  topics: TopicItem[];
  loading: boolean;
  onBackToSubjects: () => void;
  onStartSubjectDrill: (subjectId: number, subjectName: string) => void;
  onStartTopicDrill: (subjectId: number, topicId: number, topicName: string) => void;
  onStartSubtopicDrill: (subjectId: number, topicId: number, subtopicId: number, subtopicName: string) => void;
  onViewQuestions: (subjectId: number, topicId?: number, subtopicId?: number) => void;
}

const formatSubtopicName = (topicName: string, subtopicName: string): string => {
  const tClean = topicName.trim().toLowerCase();
  const sClean = subtopicName.trim();
  if (sClean.toLowerCase() === tClean) {
    return 'Core Concepts';
  }
  const prefixDash = `${topicName.trim()} - `;
  const prefixColon = `${topicName.trim()}: `;
  if (sClean.toLowerCase().startsWith(prefixDash.toLowerCase())) {
    return sClean.slice(prefixDash.length).trim() || sClean;
  }
  if (sClean.toLowerCase().startsWith(prefixColon.toLowerCase())) {
    return sClean.slice(prefixColon.length).trim() || sClean;
  }
  return sClean;
};

export const TopicsHubView: React.FC<TopicsHubViewProps> = ({
  subject,
  topics,
  loading,
  onBackToSubjects,
  onStartSubjectDrill,
  onStartTopicDrill,
  onStartSubtopicDrill,
  onViewQuestions,
}) => {
  const [searchText, setSearchText] = useState('');
  const [weakOnly, setWeakOnly] = useState(false);
  const [unattemptedOnly, setUnattemptedOnly] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({});

  const totalSubtopics = useMemo(
    () => topics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0),
    [topics]
  );

  const filteredTopics = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return topics.filter((topic) => {
      const prog = topic.user_progress;
      const attempted = prog?.attempted || 0;
      const accuracy = prog?.accuracy_percentage || 0;

      if (weakOnly && (attempted === 0 || accuracy >= 60)) return false;
      if (unattemptedOnly && attempted > 0) return false;

      if (!q) return true;
      if (topic.name.toLowerCase().includes(q)) return true;
      if (topic.subtopics?.some((s) => s.name.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [topics, searchText, weakOnly, unattemptedOnly]);

  const setAllExpanded = (expanded: boolean) => {
    const next: Record<number, boolean> = {};
    topics.forEach((t) => {
      next[t.id] = expanded;
    });
    setExpandedTopics(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Breadcrumb & Subject Header */}
      <div className="ui-card" style={{ padding: '20px 24px' }}>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '12px' }}>
          <button
            type="button"
            className="compact-tap"
            onClick={onBackToSubjects}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Subjects
          </button>
          <ChevronRight size={14} style={{ color: 'var(--text-neutral)' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{subject.name}</span>
        </nav>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {subject.name}
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}>
                {subject.code}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {topics.length} topics &bull; {totalSubtopics} subtopics &bull; {subject.total_questions.toLocaleString()} MCQs
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-teal"
              onClick={() => onStartSubjectDrill(subject.id, subject.name)}
            >
              <Zap size={15} />
              <span>Quick Drill (15)</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onViewQuestions(subject.id)}
            >
              <ListChecks size={15} />
              <span>View MCQs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Filter & Controls Toolbar */}
      <div
        className="ui-card"
        style={{
          position: 'sticky',
          top: '76px',
          zIndex: 30,
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
            size={15}
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
            aria-label="Search topics and subtopics"
            placeholder="Search topics or subtopics..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="compact-tap"
            onClick={() => {
              setWeakOnly((w) => !w);
              if (!weakOnly) setUnattemptedOnly(false);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: weakOnly ? 'var(--danger-bg)' : 'var(--bg-subtle)',
              color: weakOnly ? 'var(--danger)' : 'var(--text-secondary)',
              border: `1px solid ${weakOnly ? 'var(--danger-border)' : 'var(--border)'}`,
            }}
          >
            Weak topics only
          </button>

          <button
            type="button"
            className="compact-tap"
            onClick={() => {
              setUnattemptedOnly((u) => !u);
              if (!unattemptedOnly) setWeakOnly(false);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: unattemptedOnly ? 'var(--primary)' : 'var(--bg-subtle)',
              color: unattemptedOnly ? '#FFFFFF' : 'var(--text-secondary)',
              border: `1px solid ${unattemptedOnly ? 'var(--primary)' : 'var(--border)'}`,
            }}
          >
            Unattempted only
          </button>

          <button
            type="button"
            className="compact-tap btn-outline"
            onClick={() => setAllExpanded(true)}
            style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          >
            <ChevronsUpDown size={14} />
            <span>Expand all</span>
          </button>

          <button
            type="button"
            className="compact-tap btn-outline"
            onClick={() => setAllExpanded(false)}
            style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
          >
            <ChevronsDownUp size={14} />
            <span>Collapse all</span>
          </button>
        </div>
      </div>

      {/* Accordion List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="skeleton" style={{ height: '64px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="ui-card" style={{ padding: '44px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <FolderOpen size={36} style={{ color: 'var(--text-neutral)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            No matching topics found
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Adjust your search or filter toggles to view all {topics.length} topics in {subject.name}.
          </p>
          <button
            type="button"
            className="btn btn-teal"
            onClick={() => {
              setSearchText('');
              setWeakOnly(false);
              setUnattemptedOnly(false);
            }}
          >
            <RotateCcw size={14} />
            <span>Reset filters</span>
          </button>
        </div>
      ) : (
        <div className="ui-card" style={{ overflow: 'hidden' }}>
          {filteredTopics.map((topic, idx) => {
            const prog = topic.user_progress;
            const attempted = prog?.attempted || 0;
            const solved = prog?.solved || 0;
            const accuracy = prog?.accuracy_percentage || 0;
            const pct = topic.total_questions > 0
              ? Math.min(100, Math.round((solved / topic.total_questions) * 100))
              : 0;
            const subList = topic.subtopics || [];
            const isExpanded = !!expandedTopics[topic.id];

            return (
              <div
                key={topic.id}
                style={{
                  borderBottom: idx < filteredTopics.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Topic Row */}
                <div
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    backgroundColor: isExpanded ? 'var(--bg-subtle)' : 'var(--bg-card)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => subList.length > 0 && setExpandedTopics((p) => ({ ...p, [topic.id]: !isExpanded }))}
                    aria-expanded={subList.length > 0 ? isExpanded : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flex: '1 1 260px',
                      minWidth: 0,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: subList.length > 0 ? 'pointer' : 'default',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0, width: '18px' }}>
                      {subList.length > 0 ? (isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />) : null}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {topic.name}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-main)',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                        }}>
                          {topic.total_questions} MCQs
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Progress & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
                      <div style={{ width: '80px', height: '6px', borderRadius: '999px', backgroundColor: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: attempted > 0 ? (accuracy >= 60 ? 'var(--success)' : 'var(--danger)') : 'var(--text-neutral)',
                        }} />
                      </div>
                      {attempted > 0 ? (
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          color: accuracy >= 60 ? 'var(--success)' : 'var(--danger)',
                        }}>
                          {solved}/{topic.total_questions} &bull; {accuracy}%
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-neutral)', whiteSpace: 'nowrap' }}>
                          Not started
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="compact-tap btn-teal"
                        onClick={() => onStartTopicDrill(subject.id, topic.id, topic.name)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Zap size={13} />
                        <span>Drill</span>
                      </button>

                      <button
                        type="button"
                        className="compact-tap btn-outline"
                        onClick={() => onViewQuestions(subject.id, topic.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View MCQs
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtopics Single-Line Rows */}
                {isExpanded && subList.length > 0 && (
                  <div style={{ backgroundColor: 'var(--bg-main)', borderTop: '1px solid var(--border-subtle)' }}>
                    {subList.map((sub, sIdx) => {
                      const sp = sub.user_progress;
                      const sAttempted = sp?.attempted || 0;
                      const sSolved = sp?.solved || 0;
                      const sAcc = sp?.accuracy_percentage || 0;
                      const sPct = sub.total_questions > 0
                        ? Math.min(100, Math.round((sSolved / sub.total_questions) * 100))
                        : 0;
                      const displayName = formatSubtopicName(topic.name, sub.name);

                      return (
                        <div
                          key={sub.id}
                          style={{
                            padding: '10px 16px 10px 44px',
                            borderBottom: sIdx < subList.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 220px', minWidth: 0 }}>
                            <span style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {displayName}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {sub.total_questions} MCQs
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '64px', height: '4px', borderRadius: '999px', backgroundColor: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{
                                  width: `${sPct}%`,
                                  height: '100%',
                                  backgroundColor: sAttempted > 0 ? (sAcc >= 60 ? 'var(--success)' : 'var(--danger)') : 'var(--text-neutral)',
                                }} />
                              </div>
                              {sAttempted > 0 ? (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  color: sAcc >= 60 ? 'var(--success)' : 'var(--danger)',
                                }}>
                                  {sSolved}/{sub.total_questions} &bull; {sAcc}%
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-neutral)', whiteSpace: 'nowrap' }}>
                                  Not started
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="compact-tap"
                                onClick={() => onStartSubtopicDrill(subject.id, topic.id, sub.id, displayName)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--primary-soft)',
                                  color: 'var(--primary)',
                                  border: '1px solid transparent',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Drill
                              </button>
                              <button
                                type="button"
                                className="compact-tap"
                                onClick={() => onViewQuestions(subject.id, topic.id, sub.id)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--bg-card)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border)',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                View MCQs
                              </button>
                            </div>
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
};
