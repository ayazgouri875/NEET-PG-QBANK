import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/constants/api_constants.dart';
import '../core/constants/app_colors.dart';

class ClinicalImageViewer extends StatelessWidget {
  final String filename;
  final String? caption;
  final bool isThumbnail;

  const ClinicalImageViewer({
    super.key,
    required this.filename,
    this.caption,
    this.isThumbnail = false,
  });

  String get fullImageUrl {
    return "${ApiConstants.mediaBaseUrl}/media/images/$filename";
  }

  void _openFullScreen(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (ctx) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
            title: Text(caption ?? "Clinical Image"),
          ),
          body: Center(
            child: InteractiveViewer(
              panEnabled: true,
              minScale: 0.5,
              maxScale: 4.0,
              child: CachedNetworkImage(
                imageUrl: fullImageUrl,
                placeholder: (context, url) => const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
                errorWidget: (context, url, error) => const Center(
                  child: Icon(Icons.broken_image, color: Colors.white54, size: 48),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _openFullScreen(context),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.borderLight),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: isThumbnail ? 180 : 300,
                  ),
                  child: CachedNetworkImage(
                    imageUrl: fullImageUrl,
                    width: double.infinity,
                    fit: BoxFit.contain,
                    placeholder: (context, url) => Container(
                      height: 180,
                      color: Colors.grey.shade100,
                      child: const Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                    errorWidget: (context, url, error) => Container(
                      height: 120,
                      color: Colors.grey.shade200,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.image_not_supported_outlined, color: Colors.grey.shade600, size: 36),
                          const SizedBox(height: 6),
                          Text(
                            "Clinical Image ($filename)",
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // Zoom hint pill
                Container(
                  margin: const EdgeInsets.all(8),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.65),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.zoom_in, color: Colors.white, size: 14),
                      SizedBox(width: 4),
                      Text("Tap to Zoom", style: TextStyle(color: Colors.white, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
            if (caption != null && caption!.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                color: Colors.grey.shade50,
                child: Text(
                  caption!,
                  style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.black87),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

