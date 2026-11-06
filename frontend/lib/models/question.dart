class QuestionOption {
  final int id;
  final int optionIndex;
  final String optionLabel; // 'A', 'B', 'C', 'D'
  final String text;
  final String htmlContent;
  final bool isCorrect;

  QuestionOption({
    required this.id,
    required this.optionIndex,
    required this.optionLabel,
    required this.text,
    required this.htmlContent,
    required this.isCorrect,
  });

  factory QuestionOption.fromJson(Map<String, dynamic> json) {
    return QuestionOption(
      id: json['id'],
      optionIndex: json['option_index'],
      optionLabel: json['option_label'],
      text: json['text'],
      htmlContent: json['html_content'],
      isCorrect: json['is_correct'] ?? false,
    );
  }
}

class QuestionImage {
  final int id;
  final String imageType; // 'question' or 'explanation'
  final String filename;
  final String urlOrPath;
  final String? caption;
  final int displayOrder;

  QuestionImage({
    required this.id,
    required this.imageType,
    required this.filename,
    required this.urlOrPath,
    this.caption,
    required this.displayOrder,
  });

  factory QuestionImage.fromJson(Map<String, dynamic> json) {
    return QuestionImage(
      id: json['id'],
      imageType: json['image_type'],
      filename: json['filename'],
      urlOrPath: json['url_or_path'],
      caption: json['caption'],
      displayOrder: json['display_order'] ?? 0,
    );
  }
}

class Explanation {
  final int id;
  final String htmlContent;
  final String text;
  final String? references;

  Explanation({
    required this.id,
    required this.htmlContent,
    required this.text,
    this.references,
  });

  factory Explanation.fromJson(Map<String, dynamic> json) {
    return Explanation(
      id: json['id'],
      htmlContent: json['html_content'],
      text: json['text'],
      references: json['references'],
    );
  }
}

class Question {
  final int id;
  final String? mcqId;
  final String text;
  final String htmlContent;
  final int subjectId;
  final int? topicId;
  final int? subtopicId;
  final String difficulty;
  final bool isClinical;
  final bool hasImages;
  final int? pyqYear;
  final List<QuestionOption> options;
  final List<QuestionImage> images;
  final Explanation? explanation;

  Question({
    required this.id,
    this.mcqId,
    required this.text,
    required this.htmlContent,
    required this.subjectId,
    this.topicId,
    this.subtopicId,
    required this.difficulty,
    required this.isClinical,
    required this.hasImages,
    this.pyqYear,
    this.options = const [],
    this.images = const [],
    this.explanation,
  });

  factory Question.fromJson(Map<String, dynamic> json) {
    return Question(
      id: json['id'],
      mcqId: json['mcq_id'],
      text: json['text'],
      htmlContent: json['html_content'],
      subjectId: json['subject_id'],
      topicId: json['topic_id'],
      subtopicId: json['subtopic_id'],
      difficulty: json['difficulty'],
      isClinical: json['is_clinical'] ?? false,
      hasImages: json['has_images'] ?? false,
      pyqYear: json['pyq_year'],
      options: (json['options'] as List? ?? [])
          .map((o) => QuestionOption.fromJson(o))
          .toList(),
      images: (json['images'] as List? ?? [])
          .map((i) => QuestionImage.fromJson(i))
          .toList(),
      explanation: json['explanation'] != null
          ? Explanation.fromJson(json['explanation'])
          : null,
    );
  }
}

