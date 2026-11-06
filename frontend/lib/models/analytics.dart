class SubjectStat {
  final String subject;
  final String code;
  final String category;
  final int attempted;
  final int correct;
  final int incorrect;
  final double accuracy;

  SubjectStat({
    required this.subject,
    required this.code,
    required this.category,
    required this.attempted,
    required this.correct,
    required this.incorrect,
    required this.accuracy,
  });

  factory SubjectStat.fromJson(Map<String, dynamic> json) {
    return SubjectStat(
      subject: json['subject'],
      code: json['code'],
      category: json['category'],
      attempted: json['attempted'] ?? 0,
      correct: json['correct'] ?? 0,
      incorrect: json['incorrect'] ?? 0,
      accuracy: (json['accuracy'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class RecommendationItem {
  final int topicId;
  final String topicName;
  final String subjectName;
  final int incorrectAttempts;
  final String suggestedAction;

  RecommendationItem({
    required this.topicId,
    required this.topicName,
    required this.subjectName,
    required this.incorrectAttempts,
    required this.suggestedAction,
  });

  factory RecommendationItem.fromJson(Map<String, dynamic> json) {
    return RecommendationItem(
      topicId: json['topic_id'],
      topicName: json['topic_name'],
      subjectName: json['subject_name'],
      incorrectAttempts: json['incorrect_attempts'] ?? 0,
      suggestedAction: json['suggested_action'] ?? '',
    );
  }
}

class AnalyticsDashboardData {
  final int totalAttempted;
  final int totalCorrect;
  final int totalIncorrect;
  final double overallAccuracy;
  final int totalTimeSeconds;
  final double avgSecondsPerQuestion;
  final List<String> weakSubjects;
  final List<SubjectStat> subjectBreakdown;

  AnalyticsDashboardData({
    required this.totalAttempted,
    required this.totalCorrect,
    required this.totalIncorrect,
    required this.overallAccuracy,
    required this.totalTimeSeconds,
    required this.avgSecondsPerQuestion,
    required this.weakSubjects,
    required this.subjectBreakdown,
  });

  factory AnalyticsDashboardData.fromJson(Map<String, dynamic> json) {
    return AnalyticsDashboardData(
      totalAttempted: json['total_attempted'] ?? 0,
      totalCorrect: json['total_correct'] ?? 0,
      totalIncorrect: json['total_incorrect'] ?? 0,
      overallAccuracy: (json['overall_accuracy'] as num?)?.toDouble() ?? 0.0,
      totalTimeSeconds: json['total_time_seconds'] ?? 0,
      avgSecondsPerQuestion: (json['avg_seconds_per_question'] as num?)?.toDouble() ?? 0.0,
      weakSubjects: List<String>.from(json['weak_subjects'] ?? []),
      subjectBreakdown: (json['subject_breakdown'] as List? ?? [])
          .map((s) => SubjectStat.fromJson(s))
          .toList(),
    );
  }
}

