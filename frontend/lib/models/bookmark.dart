import 'question.dart';

class BookmarkItem {
  final int id;
  final int questionId;
  final String? notes;
  final DateTime createdAt;
  final Question question;

  BookmarkItem({
    required this.id,
    required this.questionId,
    this.notes,
    required this.createdAt,
    required this.question,
  });

  factory BookmarkItem.fromJson(Map<String, dynamic> json) {
    return BookmarkItem(
      id: json['id'],
      questionId: json['question_id'],
      notes: json['notes'],
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
      question: Question.fromJson(json['question']),
    );
  }
}

