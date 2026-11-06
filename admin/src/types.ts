export interface UserItem {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'student';
  target_exam_year?: number;
  is_active: boolean;
  created_at?: string;
}

export interface SubjectBreakdown {
  name: string;
  code: string;
  category: string;
  questions: number;
}

export interface RecentImportJob {
  id: number;
  file: string;
  status: string;
  imported: number;
  duplicates: number;
  failed: number;
  created_at: string;
}

export interface AdminStats {
  total_questions: number;
  clinical_questions: number;
  image_based_questions: number;
  previous_year_questions: number;
  total_subjects: number;
  total_topics: number;
  subject_breakdown: SubjectBreakdown[];
  recent_import_jobs: RecentImportJob[];
}

export interface QuestionOption {
  id: number;
  option_index: number;
  option_label: string;
  text: string;
  html_content: string;
  is_correct: boolean;
}

export interface QuestionImage {
  id: number;
  image_type: 'question' | 'explanation';
  filename: string;
  url_or_path: string;
  caption?: string;
  display_order: number;
}

export interface Explanation {
  id: number;
  text: string;
  html_content: string;
  references?: string;
}

export interface QuestionTag {
  id: number;
  tag_name: string;
}

export interface QuestionUserStatus {
  is_attempted: boolean;
  is_correct: boolean;
  selected_option_index?: number | null;
  answered_at?: string | null;
}

export interface QuestionItem {
  id: number;
  mcq_id?: string;
  text: string;
  html_content: string;
  subject_id: number;
  topic_id?: number;
  subtopic_id?: number;
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_clinical: boolean;
  has_images: boolean;
  is_multiple_correct: boolean;
  pyq_year?: number;
  options: QuestionOption[];
  images: QuestionImage[];
  tags: QuestionTag[];
  explanation?: Explanation;
  user_status?: QuestionUserStatus;
}

export interface PaginatedQuestions {
  total: number;
  page: number;
  page_size: number;
  items: QuestionItem[];
}

export interface SubjectItem {
  id: number;
  name: string;
  code: string;
  category: string;
  display_order: number;
  total_questions: number;
}

export interface IntegrityAudit {
  total_questions_audited: number;
  missing_explanations: number;
  missing_correct_answers: number;
  duplicate_mcq_ids_count: number;
  duplicate_samples: { mcq_id: string; count: number }[];
  data_quality_score: number;
}

export interface SubtopicItem {
  id: number;
  name: string;
  total_questions: number;
  display_order?: number;
  user_progress?: TopicUserProgress;
}

export interface TopicUserProgress {
  attempted: number;
  solved: number;
  incorrect: number;
  accuracy_percentage: number;
}

export interface TopicItem {
  id: number;
  subject_id: number;
  name: string;
  total_questions: number;
  display_order?: number;
  subtopics?: SubtopicItem[];
  user_progress?: TopicUserProgress;
}

export interface TestSession {
  id: number;
  user_id: number;
  title: string;
  test_type: 'custom' | 'grand' | 'subject';
  test_mode: 'practice' | 'exam';
  status: 'in_progress' | 'completed' | 'abandoned';
  total_questions: number;
  duration_minutes?: number;
  is_timed: boolean;
  score: number;
  correct_count: number;
  incorrect_count: number;
  skipped_count: number;
  accuracy_percentage: number;
  started_at: string;
  completed_at?: string;
  questions?: QuestionItem[];
}

export interface SubmitAnswerResult {
  question_id: number;
  selected_option_index: number | null;
  is_correct: boolean;
  correct_option_index: number;
  explanation?: string;
  references?: string;
}

export interface BookmarkItem {
  id: number;
  question_id: number;
  notes?: string;
  created_at: string;
  question: QuestionItem;
}

export interface SubjectAnalyticsItem {
  subject: string;
  code: string;
  category: string;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

export interface StudentAnalytics {
  total_attempted: number;
  total_correct: number;
  total_incorrect: number;
  overall_accuracy: number;
  total_time_seconds: number;
  avg_seconds_per_question: number;
  weak_subjects: string[];
  subject_breakdown: SubjectAnalyticsItem[];
}

export interface AttemptedQuestionItem {
  id: number;
  question_id: number;
  mcq_id?: string;
  text: string;
  html_content: string;
  subject_id: number;
  subject_name?: string;
  topic_name?: string;
  subtopic_name?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_clinical: boolean;
  has_images: boolean;
  pyq_year?: number;
  selected_option_index: number | null;
  selected_option_label?: string | null;
  selected_option_text?: string | null;
  is_correct: boolean;
  correct_option_index: number;
  correct_option_label: string;
  correct_option_text: string;
  time_spent_seconds: number;
  answered_at: string;
  options: QuestionOption[];
  images: QuestionImage[];
  explanation?: Explanation;
}

export interface AttemptedQuestionsStats {
  total_attempted: number;
  total_correct: number;
  total_incorrect: number;
  accuracy_percentage: number;
  easy_attempted: number;
  medium_attempted: number;
  hard_attempted: number;
}

export interface PaginatedAttemptedQuestions {
  total: number;
  page: number;
  page_size: number;
  stats: AttemptedQuestionsStats;
  items: AttemptedQuestionItem[];
}

export interface OTPResponse {
  status: string;
  message: string;
  email: string;
}


