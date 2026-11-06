import 'dart:async';
import 'package:flutter/material.dart';
import '../core/constants/api_constants.dart';
import '../core/services/api_service.dart';
import '../models/question.dart';
import '../models/test_session.dart';

class TestProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  TestSession? _currentSession;
  int _currentIndex = 0;
  bool _isLoading = false;
  String? _errorMessage;

  // Question State Maps
  final Map<int, int?> _selectedOptions = {}; // questionId -> optionIndex
  final Map<int, SubmitAnswerResult> _answerFeedback = {}; // questionId -> result (Practice Mode)
  final Set<int> _markedForReview = {}; // questionId set
  final Set<int> _bookmarkedQuestions = {}; // questionId set
  final Map<int, int> _questionTimeSpent = {}; // questionId -> seconds

  // Timer
  Timer? _timer;
  int _elapsedSeconds = 0;
  int _currentQuestionSeconds = 0;

  // Getters
  TestSession? get currentSession => _currentSession;
  int get currentIndex => _currentIndex;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get elapsedSeconds => _elapsedSeconds;
  int get currentQuestionSeconds => _currentQuestionSeconds;

  List<Question> get questions => _currentSession?.questions ?? [];
  Question? get currentQuestion =>
      questions.isNotEmpty && _currentIndex < questions.length
          ? questions[_currentIndex]
          : null;

  bool get isPracticeMode => _currentSession?.testMode == 'practice';
  bool get isExamMode => _currentSession?.testMode == 'exam';

  int? getSelectedOption(int questionId) => _selectedOptions[questionId];
  SubmitAnswerResult? getAnswerFeedback(int questionId) => _answerFeedback[questionId];
  bool isMarkedForReview(int questionId) => _markedForReview.contains(questionId);
  bool isBookmarked(int questionId) => _bookmarkedQuestions.contains(questionId);

  int get answeredCount => _selectedOptions.values.where((v) => v != null).length;
  int get reviewCount => _markedForReview.length;
  int get unattemptedCount => questions.length - answeredCount;

  void startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      _elapsedSeconds++;
      _currentQuestionSeconds++;
      notifyListeners();
    });
  }

  void stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<bool> createCustomTest({
    required String title,
    required String testMode, // 'practice' or 'exam'
    List<int> subjectIds = const [],
    List<int> topicIds = const [],
    int questionCount = 20,
    bool isTimed = false,
    int? durationMinutes,
    String filterStatus = 'all',
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.post(
        ApiConstants.customTest,
        body: {
          "title": title,
          "test_mode": testMode,
          "subject_ids": subjectIds,
          "topic_ids": topicIds,
          "question_count": questionCount,
          "is_timed": isTimed,
          "duration_minutes": durationMinutes,
          "filter_status": filterStatus,
        },
      );

      final sessionId = res['id'];
      // Fetch full session with questions
      await loadSession(sessionId);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> loadSession(int sessionId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get("${ApiConstants.testSession}$sessionId");
      _currentSession = TestSession.fromJson(res);
      _currentIndex = 0;
      _selectedOptions.clear();
      _answerFeedback.clear();
      _markedForReview.clear();
      _questionTimeSpent.clear();
      _elapsedSeconds = 0;
      _currentQuestionSeconds = 0;
      startTimer();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void selectOption(int optionIndex) {
    if (currentQuestion == null) return;
    final qId = currentQuestion!.id;

    // In practice mode, once answered, lock option to preserve learning integrity
    if (isPracticeMode && _answerFeedback.containsKey(qId)) {
      return;
    }

    _selectedOptions[qId] = optionIndex;
    notifyListeners();

    // In Practice Mode, immediately submit to get explanation
    if (isPracticeMode) {
      submitAnswerForCurrentQuestion();
    }
  }

  Future<void> submitAnswerForCurrentQuestion() async {
    if (currentQuestion == null || _currentSession == null) return;
    final qId = currentQuestion!.id;
    final chosenOpt = _selectedOptions[qId];

    try {
      final res = await _api.post(
        "${ApiConstants.testSession}${_currentSession!.id}/answer",
        body: {
          "question_id": qId,
          "selected_option_index": chosenOpt,
          "time_spent_seconds": _currentQuestionSeconds,
        },
      );

      final result = SubmitAnswerResult.fromJson(res);
      _answerFeedback[qId] = result;
      _questionTimeSpent[qId] = (_questionTimeSpent[qId] ?? 0) + _currentQuestionSeconds;
      _currentQuestionSeconds = 0;
      notifyListeners();
    } catch (e) {
      // In offline or transient error, keep local choice
    }
  }

  void toggleReview() {
    if (currentQuestion == null) return;
    final qId = currentQuestion!.id;
    if (_markedForReview.contains(qId)) {
      _markedForReview.remove(qId);
    } else {
      _markedForReview.add(qId);
    }
    notifyListeners();
  }

  Future<void> toggleBookmark() async {
    if (currentQuestion == null) return;
    final qId = currentQuestion!.id;
    try {
      final res = await _api.post(
        ApiConstants.bookmarkToggle,
        body: {"question_id": qId},
      );
      if (res['bookmarked'] == true) {
        _bookmarkedQuestions.add(qId);
      } else {
        _bookmarkedQuestions.remove(qId);
      }
      notifyListeners();
    } catch (_) {}
  }

  void goToQuestion(int index) {
    if (index >= 0 && index < questions.length) {
      // Record time for question being left
      if (currentQuestion != null) {
        final qId = currentQuestion!.id;
        _questionTimeSpent[qId] = (_questionTimeSpent[qId] ?? 0) + _currentQuestionSeconds;
      }
      _currentIndex = index;
      _currentQuestionSeconds = 0;
      notifyListeners();
    }
  }

  void nextQuestion() {
    if (_currentIndex < questions.length - 1) {
      goToQuestion(_currentIndex + 1);
    }
  }

  void previousQuestion() {
    if (_currentIndex > 0) {
      goToQuestion(_currentIndex - 1);
    }
  }

  Future<TestSession?> completeTest() async {
    if (_currentSession == null) return null;
    stopTimer();
    _isLoading = true;
    notifyListeners();

    try {
      // Submit any unanswered question time
      if (currentQuestion != null) {
        await submitAnswerForCurrentQuestion();
      }

      final res = await _api.post(
        "${ApiConstants.testSession}${_currentSession!.id}/complete",
      );
      final completed = TestSession.fromJson(res);
      _currentSession = completed;
      _isLoading = false;
      notifyListeners();
      return completed;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      return null;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

