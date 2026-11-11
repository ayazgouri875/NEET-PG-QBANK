import {
  AdminStats,
  AuthConfig,
  AuthSessionItem,
  BookmarkItem,
  IntegrityAudit,
  OTPResponse,
  PaginatedAttemptedQuestions,
  PaginatedQuestions,
  QuestionItem,
  RegistrationResponse,
  StatusMessageResponse,
  StudentAnalytics,
  StudySummary,
  SubjectItem,
  SubmitAnswerResult,
  TestSession,
  TopicItem,
  UserItem,
} from './types';

const API_BASE = '/api/v1';

class AdminApiClient {
  private currentUser: UserItem | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private onUnauthorized: (() => void) | null = null;

  setOnUnauthorized(cb: (() => void) | null) {
    this.onUnauthorized = cb;
  }

  getUser(): UserItem | null {
    return this.currentUser;
  }

  setUser(u: UserItem | null) {
    this.currentUser = u;
  }

  clearLocalSession() {
    this.currentUser = null;
    // Clean up any legacy token keys if present from older versions
    localStorage.removeItem('admin_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  }

  private getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private getHeaders(method: string = 'GET', extra?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      Object.assign(headers, extra as Record<string, string>);
    }
    const upperMethod = method.toUpperCase();
    if (upperMethod !== 'GET' && upperMethod !== 'HEAD' && upperMethod !== 'OPTIONS') {
      const csrf = this.getCsrfToken();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }
    return headers;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getHeaders('POST'),
        body: JSON.stringify({}),
      });
    } catch {
      // Ignore network errors during sign-out
    } finally {
      this.clearLocalSession();
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: this.getHeaders('POST'),
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          return false;
        }
        const data = await res.json();
        if (data.user) {
          this.setUser(data.user);
        }
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async authFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const method = init.method || 'GET';
    let res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: this.getHeaders(method, init.headers),
    });

    if (res.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        res = await fetch(url, {
          ...init,
          credentials: 'include',
          headers: this.getHeaders(method, init.headers),
        });
      } else {
        this.clearLocalSession();
        if (this.onUnauthorized) {
          this.onUnauthorized();
        }
      }
    }

    return res;
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

  async fetchAuthConfig(): Promise<AuthConfig> {
    const res = await fetch(`${API_BASE}/auth/config`, { credentials: 'include' });
    if (!res.ok) {
      return {
        google_enabled: false,
        google_client_id: null,
        email_verification_enabled: true,
        email_otp_enabled: true,
      };
    }
    return res.json();
  }

  async login(email: string, pass: string, rememberMe: boolean = false): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password: pass, remember_me: rememberMe }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Invalid email or password.');
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    this.setUser(data.user);
    return data.user;
  }

  async loginWithGoogleToken(credential: string): Promise<UserItem> {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Google sign-in failed');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setUser(data.user);
    return data.user;
  }

  async register(
    email: string,
    pass: string,
    confirmPass: string,
    fullName: string,
    targetYear?: number
  ): Promise<RegistrationResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        password: pass,
        confirm_password: confirmPass,
        full_name: fullName,
        target_exam_year: targetYear || 2026,
      }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Registration failed');
      throw new Error(msg);
    }
    return res.json();
  }

  async verifyEmailToken(token: string): Promise<StatusMessageResponse> {
    const res = await fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Invalid or expired verification link.');
      throw new Error(msg);
    }
    return res.json();
  }

  async resendVerificationEmail(email: string): Promise<StatusMessageResponse> {
    const res = await fetch(`${API_BASE}/auth/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to resend verification email.');
      throw new Error(msg);
    }
    return res.json();
  }

  async requestRegistrationOTP(
    email: string,
    pass: string,
    fullName: string,
    targetYear?: number
  ): Promise<OTPResponse> {
    const res = await fetch(`${API_BASE}/auth/register-otp`, {
      method: 'POST',
      credentials: 'include',
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Invalid or expired OTP code');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setUser(data.user);
    return data.user;
  }

  async forgotPassword(email: string): Promise<StatusMessageResponse> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to send password reset email');
      throw new Error(msg);
    }
    return res.json();
  }

  async resetPasswordWithToken(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<StatusMessageResponse> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Password reset failed');
      throw new Error(msg);
    }
    return res.json();
  }

  async fetchProfile(): Promise<UserItem> {
    const res = await this.authFetch(`${API_BASE}/auth/me`);
    if (!res.ok) throw new Error('Not authenticated');
    const user = await res.json();
    this.setUser(user);
    return user;
  }

  async updateProfile(data: { full_name?: string; target_exam_year?: number }): Promise<UserItem> {
    const res = await this.authFetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to update profile');
      throw new Error(msg);
    }
    const user = await res.json();
    this.setUser(user);
    return user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<UserItem> {
    const res = await this.authFetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: newPassword,
      }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to change password');
      throw new Error(msg);
    }
    const data = await res.json();
    this.setUser(data.user);
    return data.user;
  }

  async fetchSessions(): Promise<AuthSessionItem[]> {
    const res = await this.authFetch(`${API_BASE}/auth/sessions`);
    if (!res.ok) throw new Error('Failed to load active sessions');
    return res.json();
  }

  async revokeSession(sessionId: number): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to revoke session');
  }

  async logoutAllDevices(): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/auth/logout-all`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    this.clearLocalSession();
    if (this.onUnauthorized) {
      this.onUnauthorized();
    }
    if (!res.ok) throw new Error('Failed to sign out all devices');
  }

  async fetchStats(): Promise<AdminStats> {
    const res = await this.authFetch(`${API_BASE}/admin/stats`);
    if (!res.ok) throw new Error('Failed to load stats');
    return res.json();
  }

  async fetchIntegrityAudit(): Promise<IntegrityAudit> {
    const res = await this.authFetch(`${API_BASE}/admin/analytics/integrity`);
    if (!res.ok) throw new Error('Failed to load integrity audit');
    return res.json();
  }

  private cachedFilterMeta: { pyq_years: number[] } | null = null;

  async fetchQuestionFiltersMeta(): Promise<{ pyq_years: number[] }> {
    if (this.cachedFilterMeta) return this.cachedFilterMeta;
    const res = await this.authFetch(`${API_BASE}/questions/filters-meta`);
    if (!res.ok) return { pyq_years: [] };
    this.cachedFilterMeta = await res.json();
    return this.cachedFilterMeta!;
  }

  async fetchQuestions(params: {
    page?: number;
    page_size?: number;
    subject_id?: number;
    subject_ids?: number[];
    topic_id?: number;
    subtopic_id?: number;
    difficulty?: string;
    status_filter?: string;
    is_clinical?: boolean;
    has_images?: boolean;
    pyq_year?: number;
    q?: string;
  }): Promise<PaginatedQuestions> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());
    if (params.subject_id) query.append('subject_id', params.subject_id.toString());
    if (params.subject_ids && params.subject_ids.length > 0) {
      query.append('subject_ids', params.subject_ids.join(','));
    }
    if (params.topic_id) query.append('topic_id', params.topic_id.toString());
    if (params.subtopic_id) query.append('subtopic_id', params.subtopic_id.toString());
    if (params.difficulty) query.append('difficulty', params.difficulty);
    if (params.status_filter) query.append('status_filter', params.status_filter);
    if (params.is_clinical !== undefined) query.append('is_clinical', params.is_clinical.toString());
    if (params.has_images !== undefined) query.append('has_images', params.has_images.toString());
    if (params.pyq_year) query.append('pyq_year', params.pyq_year.toString());
    if (params.q) query.append('q', params.q);

    const res = await this.authFetch(`${API_BASE}/questions/?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch questions');
    return res.json();
  }

  async reportQuestion(questionId: number, reason: string, details?: string): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/questions/${questionId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, details: details || undefined }),
    });
    if (!res.ok) {
      const msg = await this.parseErrorMessage(res, 'Failed to submit report');
      throw new Error(msg);
    }
  }

  async fetchQuestionDetail(id: number): Promise<QuestionItem> {
    const res = await this.authFetch(`${API_BASE}/questions/${id}`);
    if (!res.ok) throw new Error('Failed to load question details');
    return res.json();
  }

  async updateQuestion(id: number, data: Partial<QuestionItem>): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/admin/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update question');
  }

  async updateOptions(
    id: number,
    options: { id: number; text: string; is_correct: boolean }[]
  ): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/admin/questions/${id}/options`, {
      method: 'PUT',
      body: JSON.stringify({ options }),
    });
    if (!res.ok) throw new Error('Failed to update options');
  }

  async updateExplanation(
    id: number,
    data: { text: string; html_content: string; references?: string }
  ): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/admin/questions/${id}/explanation`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update explanation');
  }

  async deactivateQuestion(id: number): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/admin/questions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to deactivate question');
  }

  async fetchSubjects(): Promise<SubjectItem[]> {
    const res = await this.authFetch(`${API_BASE}/subjects/`);
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  }

  async createSubject(data: {
    name: string;
    code: string;
    category: string;
    display_order?: number;
  }): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/admin/categories/subjects`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create subject');
  }

  async bulkCategorize(
    questionIds: number[],
    subjectId: number,
    topicId?: number
  ): Promise<void> {
    const res = await this.authFetch(`${API_BASE}/admin/questions/bulk-categorize`, {
      method: 'POST',
      body: JSON.stringify({
        question_ids: questionIds,
        subject_id: subjectId,
        topic_id: topicId,
      }),
    });
    if (!res.ok) throw new Error('Failed to bulk categorize');
  }

  async fetchTopics(subjectId: number): Promise<TopicItem[]> {
    const res = await this.authFetch(`${API_BASE}/subjects/${subjectId}/topics`);
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
    question_ids?: number[];
    question_count?: number;
    is_timed?: boolean;
    duration_minutes?: number;
    filter_status?: string;
    difficulty?: string;
  }): Promise<TestSession> {
    const res = await this.authFetch(`${API_BASE}/tests/custom`, {
      method: 'POST',
      body: JSON.stringify({
        title: params.title || 'Custom Practice Test',
        test_type: params.test_type || 'custom',
        test_mode: params.test_mode || 'practice',
        subject_ids: params.subject_ids || [],
        topic_ids: params.topic_ids || [],
        subtopic_ids: params.subtopic_ids || [],
        question_ids: params.question_ids || undefined,
        question_count: params.question_count || 10,
        is_timed: params.is_timed ?? false,
        duration_minutes: params.duration_minutes,
        filter_status: params.filter_status || 'all',
        difficulty: params.difficulty,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create test session');
    }
    return res.json();
  }

  async toggleMarkForReview(sessionId: number, questionId: number): Promise<{ marked: boolean }> {
    const res = await this.authFetch(`${API_BASE}/tests/${sessionId}/mark/${questionId}`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to update review mark');
    return res.json();
  }

  async fetchTestSession(sessionId: number): Promise<TestSession> {
    const res = await this.authFetch(`${API_BASE}/tests/${sessionId}`);
    if (!res.ok) throw new Error('Failed to load test session');
    return res.json();
  }

  async submitAnswer(
    sessionId: number,
    questionId: number,
    selectedOptionIndex: number | null,
    timeSpentSeconds: number = 0
  ): Promise<SubmitAnswerResult> {
    const res = await this.authFetch(`${API_BASE}/tests/${sessionId}/answer`, {
      method: 'POST',
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
    const res = await this.authFetch(`${API_BASE}/tests/${sessionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to finalize test session');
    return res.json();
  }

  async toggleBookmark(questionId: number, notes?: string): Promise<{ bookmarked: boolean }> {
    const res = await this.authFetch(`${API_BASE}/bookmarks/toggle`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        notes: notes || undefined,
      }),
    });
    if (!res.ok) throw new Error('Failed to toggle bookmark');
    return res.json();
  }

  async saveBookmarkNote(questionId: number, notes: string): Promise<{ status: string; notes: string | null }> {
    const res = await this.authFetch(`${API_BASE}/bookmarks/note`, {
      method: 'PUT',
      body: JSON.stringify({ question_id: questionId, notes }),
    });
    if (!res.ok) throw new Error('Failed to save note');
    return res.json();
  }

  async fetchBookmarks(subjectId?: number): Promise<BookmarkItem[]> {
    const url = subjectId ? `${API_BASE}/bookmarks/?subject_id=${subjectId}` : `${API_BASE}/bookmarks/`;
    const res = await this.authFetch(url);
    if (!res.ok) throw new Error('Failed to fetch bookmarks');
    return res.json();
  }

  async fetchStudentAnalytics(): Promise<StudentAnalytics> {
    const res = await this.authFetch(`${API_BASE}/analytics/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  }

  async fetchStudySummary(dailyTarget: number = 30): Promise<StudySummary> {
    const res = await this.authFetch(`${API_BASE}/analytics/study-summary?daily_target=${dailyTarget}`);
    if (!res.ok) throw new Error('Failed to fetch study summary');
    return res.json();
  }

  async fetchAttemptedQuestions(params: {
    page?: number;
    page_size?: number;
    status_filter?: string;
    subject_id?: number;
    difficulty?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
  }): Promise<PaginatedAttemptedQuestions> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.page_size) query.append('page_size', params.page_size.toString());
    if (params.status_filter) query.append('status_filter', params.status_filter);
    if (params.subject_id) query.append('subject_id', params.subject_id.toString());
    if (params.difficulty) query.append('difficulty', params.difficulty);
    if (params.date_from) query.append('date_from', params.date_from);
    if (params.date_to) query.append('date_to', params.date_to);
    if (params.q) query.append('q', params.q);

    const res = await this.authFetch(`${API_BASE}/questions/attempted?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch attempted questions');
    return res.json();
  }

  async solveQuestionDirectly(
    questionId: number,
    selectedOptionIndex: number,
    timeSpentSeconds: number = 10
  ): Promise<SubmitAnswerResult> {
    const res = await this.authFetch(`${API_BASE}/questions/${questionId}/solve`, {
      method: 'POST',
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
