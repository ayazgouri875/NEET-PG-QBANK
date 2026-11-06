import {
  AdminStats,
  AttemptedQuestionItem,
  BookmarkItem,
  IntegrityAudit,
  OTPResponse,
  PaginatedAttemptedQuestions,
  PaginatedQuestions,
  QuestionItem,
  StudentAnalytics,
  SubjectItem,
  SubmitAnswerResult,
  TestSession,
  TopicItem,
  UserItem,
} from './types';

const API_BASE = '/api/v1';

class AdminApiClient {
  private token: string | null = null;
  private currentUser: UserItem | null = null;

  setToken(t: string | null) {
    this.token = t;
    if (t) {
      localStorage.setItem('admin_token', t);
    } else {
      localStorage.removeItem('admin_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('admin_token');
    }
    return this.token;
  }

  getUser(): UserItem | null {
    if (!this.currentUser) {
      const raw = localStorage.getItem('user_info');
      if (raw) {
        try {
          this.currentUser = JSON.parse(raw);
        } catch {
          this.currentUser = null;
        }
      }
    }
    return this.currentUser;
  }

  setUser(u: UserItem | null) {
    this.currentUser = u;
    if (u) {
      localStorage.setItem('user_info', JSON.stringify(u));
    } else {
      localStorage.removeItem('user_info');
    }
  }

  logout() {
    this.setToken(null);
    this.setUser(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('user_info');
  }

  async ensureAuth(): Promise<void> {
    if (!this.getToken()) {
      // If no token exists, attempt auto-login or throw
      try {
        await this.login('admin@neetpg.com', 'AdminPassword123');
      } catch (e) {
        console.warn('Auto-login skipped:', e);
      }
    }
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const t = this.getToken();
    if (t) {
      headers['Authorization'] = `Bearer ${t}`;
    }
    return headers;
  }

  private async parseErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const err = await res.json();
      if (err.detail) {
        if (typeof err.detail === 'string') return err.detail;
        if (Array.isArray(err.detail) && err.detail.length > 0) {
          return err.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
        return JSON.stringify(err.detail);
      }
      if (err.message) return err.message;
    } catch {
      // Ignore JSON parse errors
    }
    return fallback;
  }

  async login(email: string, pass: string): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Invalid email or password');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    this.setUser(data.user);
    return data.user;
  }

  async loginWithGoogle(email: string, fullName?: string): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName || 'Medical Student' }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Google sign-in failed');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    this.setUser(data.user);
    return data.user;
  }

  async register(email: string, pass: string, fullName: string, targetYear?: number): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: pass,
        full_name: fullName,
        target_exam_year: targetYear || 2026,
      }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Registration failed');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    this.setUser(data.user);
    return data.user;
  }

  async requestRegistrationOTP(
    email: string,
    pass: string,
    fullName: string,
    targetYear?: number
  ): Promise<OTPResponse> {
    const res = await fetch(`${API_BASE}/auth/register-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: pass,
        full_name: fullName,
        target_exam_year: targetYear || 2026,
      }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to dispatch verification OTP');
      throw new Error(msg);
    }
    return res.json();
  }

  async verifyOTP(email: string, otpCode: string): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        otp_code: otpCode,
      }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Invalid or expired OTP code');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setToken(data.access_token);
    this.setUser(data.user);
    return data.user;
  }

  async resendOTP(email: string): Promise<OTPResponse> {
    const res = await fetch(`${API_BASE}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to resend verification code');
      throw new Error(msg);
    }
    return res.json();
  }

  async fetchProfile(): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load profile');
    const user = await res.json();
    this.setUser(user);
    return user;
  }

  async fetchStats(): Promise<AdminStats> {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load stats');
    return res.json();
  }

  async fetchIntegrityAudit(): Promise<IntegrityAudit> {
    const res = await fetch(`${API_BASE}/admin/analytics/integrity`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load integrity audit');
    return res.json();
  }

  async fetchQuestions(params: {
    page?: number;
    page_size?: number;
    subject_id?: number;
    topic_id?: number;
    subtopic_id?: number;
    difficulty?: string;
    status_filter?: string;
    is_clinical?: boolean;
    has_images?: boolean;
    q?: string;
  }): Promise<PaginatedQuestions> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());
    if (params.subject_id) query.append('subject_id', params.subject_id.toString());
    if (params.topic_id) query.append('topic_id', params.topic_id.toString());
    if (params.subtopic_id) query.append('subtopic_id', params.subtopic_id.toString());
    if (params.difficulty) query.append('difficulty', params.difficulty);
    if (params.status_filter) query.append('status_filter', params.status_filter);
    if (params.is_clinical !== undefined) query.append('is_clinical', params.is_clinical.toString());
    if (params.has_images !== undefined) query.append('has_images', params.has_images.toString());
    if (params.q) query.append('q', params.q);

    const res = await fetch(`${API_BASE}/questions/?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch questions');
    return res.json();
  }

  async fetchQuestionDetail(id: number): Promise<QuestionItem> {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load question details');
    return res.json();
  }

  async updateQuestion(id: number, data: Partial<QuestionItem>): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update question');
  }

  async updateOptions(
    id: number,
    options: { id: number; text: string; is_correct: boolean }[]
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/questions/${id}/options`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ options }),
    });
    if (!res.ok) throw new Error('Failed to update options');
  }

  async updateExplanation(
    id: number,
    data: { text: string; html_content: string; references?: string }
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/questions/${id}/explanation`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update explanation');
  }

  async deactivateQuestion(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to deactivate question');
  }

  async fetchSubjects(): Promise<SubjectItem[]> {
    const res = await fetch(`${API_BASE}/subjects/`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  }

  async createSubject(data: {
    name: string;
    code: string;
    category: string;
    display_order?: number;
  }): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/categories/subjects`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create subject');
  }

  async bulkCategorize(
    questionIds: number[],
    subjectId: number,
    topicId?: number
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/questions/bulk-categorize`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        question_ids: questionIds,
        subject_id: subjectId,
        topic_id: topicId,
      }),
    });
    if (!res.ok) throw new Error('Failed to bulk categorize');
  }

  async fetchTopics(subjectId: number): Promise<TopicItem[]> {
    const res = await fetch(`${API_BASE}/subjects/${subjectId}/topics`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch topics');
    return res.json();
  }

  async createCustomTest(params: {
    title?: string;
    test_type?: string;
    test_mode?: string;
    subject_ids?: number[];
    topic_ids?: number[];
    subtopic_ids?: number[];
    question_count?: number;
    is_timed?: boolean;
    duration_minutes?: number;
    difficulty?: string;
  }): Promise<TestSession> {
    const res = await fetch(`${API_BASE}/tests/custom`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        title: params.title || 'Custom Practice Test',
        test_type: params.test_type || 'custom',
        test_mode: params.test_mode || 'practice',
        subject_ids: params.subject_ids || [],
        topic_ids: params.topic_ids || [],
        subtopic_ids: params.subtopic_ids || [],
        question_count: params.question_count || 10,
        is_timed: params.is_timed ?? false,
        duration_minutes: params.duration_minutes,
        difficulty: params.difficulty,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create test session');
    }
    return res.json();
  }

  async fetchTestSession(sessionId: number): Promise<TestSession> {
    const res = await fetch(`${API_BASE}/tests/${sessionId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load test session');
    return res.json();
  }

  async submitAnswer(
    sessionId: number,
    questionId: number,
    selectedOptionIndex: number | null,
    timeSpentSeconds: number = 0
  ): Promise<SubmitAnswerResult> {
    const res = await fetch(`${API_BASE}/tests/${sessionId}/answer`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        question_id: questionId,
        selected_option_index: selectedOptionIndex,
        time_spent_seconds: timeSpentSeconds,
      }),
    });
    if (!res.ok) throw new Error('Failed to submit answer');
    return res.json();
  }

  async completeTest(sessionId: number): Promise<TestSession> {
    const res = await fetch(`${API_BASE}/tests/${sessionId}/complete`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to finalize test session');
    return res.json();
  }

  async toggleBookmark(questionId: number, notes?: string): Promise<{ bookmarked: boolean }> {
    const res = await fetch(`${API_BASE}/bookmarks/toggle`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        question_id: questionId,
        notes: notes || undefined,
      }),
    });
    if (!res.ok) throw new Error('Failed to toggle bookmark');
    return res.json();
  }

  async fetchBookmarks(): Promise<BookmarkItem[]> {
    const res = await fetch(`${API_BASE}/bookmarks/`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch bookmarks');
    return res.json();
  }

  async fetchStudentAnalytics(): Promise<StudentAnalytics> {
    const res = await fetch(`${API_BASE}/analytics/dashboard`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  }

  async fetchAttemptedQuestions(params: {
    page?: number;
    page_size?: number;
    status_filter?: string;
    subject_id?: number;
    difficulty?: string;
    q?: string;
  }): Promise<PaginatedAttemptedQuestions> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());
    if (params.status_filter) query.append('status_filter', params.status_filter);
    if (params.subject_id) query.append('subject_id', params.subject_id.toString());
    if (params.difficulty) query.append('difficulty', params.difficulty);
    if (params.q) query.append('q', params.q);

    const res = await fetch(`${API_BASE}/questions/attempted?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch attempted questions');
    return res.json();
  }

  async solveQuestionDirectly(
    questionId: number,
    selectedOptionIndex: number,
    timeSpentSeconds: number = 10
  ): Promise<SubmitAnswerResult> {
    const res = await fetch(`${API_BASE}/questions/${questionId}/solve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        selected_option_index: selectedOptionIndex,
        time_spent_seconds: timeSpentSeconds,
      }),
    });
    if (!res.ok) throw new Error('Failed to submit question response');
    return res.json();
  }
}

export const adminApi = new AdminApiClient();

