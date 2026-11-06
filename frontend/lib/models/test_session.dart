import 'question.dart';

class TestSession {
  final int id;
  final int userId;
  final String title;
  final String testType;
  final String testMode; // 'practice' or 'exam'
  final String status;   // 'in_progress' or 'completed'
  final int totalQuestions;
  final int? durationMinutes;
  final bool isTimed;
  final double score;
  final int correctCount;
  final int incorrectCount;
  final int skippedCount;
  final double accuracyPercentage;
  final List<Question> questions;

  TestSession({
    required this.id,
    required this.userId,
    required this.title,
    required this.testType,
    required this.testMode,
    required this.status,
    required this.totalQuestions,
    this.durationMinutes,
    required this.isTimed,
    required this.score,
    required this.correctCount,
    required this.incorrectCount,
    required this.skippedCount,
    required this.accuracyPercentage,
    this.questions = const [],
  });

  factory TestSession.fromJson(Map<String, dynamic> json) {
    return TestSession(
      id: json['id'],
      userId: json['user_id'],
      title: json['title'],
      testType: json['test_type'],
      testMode: json['test_mode'],
      status: json['status'],
      totalQuestions: json['total_questions'] ?? 0,
      durationMinutes: json['duration_minutes'],
      isTimed: json['is_timed'] ?? false,
      score: (json['score'] as num?)?.toDouble() ?? 0.0,
      correctCount: json['correct_count'] ?? 0,
      incorrectCount: json['incorrect_count'] ?? 0,
      skippedCount: json['skipped_count'] ?? 0,
      accuracyPercentage: (json['accuracy_percentage'] as num?)?.toDouble() ?? 0.0,
      questions: (json['questions'] as List? ?? [])
          .map((q) => Question.fromJson(q))
          .toList(),
    );
  }
}

class SubmitAnswerResult {
  final int questionId;
  final int? selectedOptionIndex;
  final bool isCorrect;
  final int correctOptionIndex;
  final String? explanation;
  final String? references;

  SubmitAnswerResult({
    required this.questionId,
    this.selectedOptionIndex,
    required this.isCorrect,
    required this.correctOptionIndex,
    this.explanation,
    this.references,
  });

  factory SubmitAnswerResult.fromJson(Map<String, dynamic> json) {
    return SubmitAnswerResult(
      questionId: json['question_id'],
      selectedOptionIndex: json['selected_option_index'],
      isCorrect: json['is_correct'] ?? false,
      correctOptionIndex: json['correct_option_index'] ?? 0,
      explanation: json['explanation'],
      references: json['references'],
    );
  }
}

