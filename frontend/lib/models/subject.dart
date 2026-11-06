class Subtopic {
  final int id;
  final String name;
  final int displayOrder;
  final int totalQuestions;

  Subtopic({
    required this.id,
    required this.name,
    required this.displayOrder,
    required this.totalQuestions,
  });

  factory Subtopic.fromJson(Map<String, dynamic> json) {
    return Subtopic(
      id: json['id'],
      name: json['name'],
      displayOrder: json['display_order'] ?? 0,
      totalQuestions: json['total_questions'] ?? 0,
    );
  }
}

class Topic {
  final int id;
  final int subjectId;
  final String name;
  final int displayOrder;
  final int totalQuestions;
  final List<Subtopic> subtopics;

  Topic({
    required this.id,
    required this.subjectId,
    required this.name,
    required this.displayOrder,
    required this.totalQuestions,
    required this.subtopics,
  });

  factory Topic.fromJson(Map<String, dynamic> json) {
    return Topic(
      id: json['id'],
      subjectId: json['subject_id'],
      name: json['name'],
      displayOrder: json['display_order'] ?? 0,
      totalQuestions: json['total_questions'] ?? 0,
      subtopics: (json['subtopics'] as List? ?? [])
          .map((s) => Subtopic.fromJson(s))
          .toList(),
    );
  }
}

class Subject {
  final int id;
  final String name;
  final String code;
  final String category; // Pre-clinical, Para-clinical, Clinical
  final int displayOrder;
  final String? iconName;
  final int totalQuestions;
  final List<Topic> topics;

  Subject({
    required this.id,
    required this.name,
    required this.code,
    required this.category,
    required this.displayOrder,
    this.iconName,
    required this.totalQuestions,
    this.topics = const [],
  });

  factory Subject.fromJson(Map<String, dynamic> json) {
    return Subject(
      id: json['id'],
      name: json['name'],
      code: json['code'],
      category: json['category'],
      displayOrder: json['display_order'] ?? 0,
      iconName: json['icon_name'],
      totalQuestions: json['total_questions'] ?? 0,
      topics: (json['topics'] as List? ?? [])
          .map((t) => Topic.fromJson(t))
          .toList(),
    );
  }
}

