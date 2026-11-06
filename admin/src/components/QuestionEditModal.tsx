import React, { useState } from 'react';
import { QuestionItem } from '../types';
import { adminApi } from '../api';

interface QuestionEditModalProps {
  question: QuestionItem;
  onClose: () => void;
  onSaved: () => void;
}

export const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  question,
  onClose,
  onSaved,
}) => {
  const [text, setText] = useState(question.text);
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [isClinical, setIsClinical] = useState(question.is_clinical);
  const [pyqYear, setPyqYear] = useState<number | undefined>(question.pyq_year);

  // Options state
  const [options, setOptions] = useState(
    question.options.map((o) => ({
      id: o.id,
      label: o.option_label,
      text: o.text,
      is_correct: o.is_correct,
    }))
  );

  // Explanation state
  const [explanationText, setExplanationText] = useState(
    question.explanation?.text || ''
  );
  const [references, setReferences] = useState(
    question.explanation?.references || ''
  );

  const [saving, setSaving] = useState(false);

  const handleCorrectSelect = (index: number) => {
    setOptions((prev) =>
      prev.map((opt, i) => ({
        ...opt,
        is_correct: i === index,
      }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update Question metadata
      await adminApi.updateQuestion(question.id, {
        text,
        difficulty,
        is_clinical: isClinical,
        pyq_year: pyqYear || undefined,
      });

      // 2. Update Options
      await adminApi.updateOptions(
        question.id,
        options.map((o) => ({ id: o.id, text: o.text, is_correct: o.is_correct }))
      );

      // 3. Update Explanation
      await adminApi.updateExplanation(question.id, {
        text: explanationText,
        html_content: `<p>${explanationText}</p>`,
        references: references || undefined,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              Edit MCQ {question.mcq_id || `#${question.id}`}
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Anki Source NID: {question.id}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Question Text */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Question Prompt Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Metadata Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                }}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Previous Year Exam (PYQ)
              </label>
              <input
                type="number"
                value={pyqYear || ''}
                placeholder="e.g. 2021"
                onChange={(e) => setPyqYear(e.target.value ? parseInt(e.target.value) : undefined)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
              <input
                type="checkbox"
                id="isClinical"
                checked={isClinical}
                onChange={(e) => setIsClinical(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="isClinical" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Clinical Vignette Scenario
              </label>
            </div>
          </div>

          {/* Options List */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
              Answer Options (Select radio for Correct Answer)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {options.map((opt, idx) => (
                <div
                  key={opt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: opt.is_correct ? '#ECFDF5' : '#F8FAFC',
                    border: `1px solid ${opt.is_correct ? '#10B981' : '#E2E8F0'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="correctOption"
                    checked={opt.is_correct}
                    onChange={() => handleCorrectSelect(idx)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: opt.is_correct ? '#065F46' : '#64748B' }}>
                    Option {opt.label}
                  </span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOptions((prev) =>
                        prev.map((o, i) => (i === idx ? { ...o, text: val } : o))
                      );
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* High-Yield Explanation */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              High-Yield Explanation
            </label>
            <textarea
              value={explanationText}
              onChange={(e) => setExplanationText(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* References */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Standard Textbook References
            </label>
            <input
              type="text"
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              placeholder="e.g. Harrison 21st Ed, Page 2134"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving Changes...' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
};

