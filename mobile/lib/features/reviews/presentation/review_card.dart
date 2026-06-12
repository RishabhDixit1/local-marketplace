import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../data/review_repository.dart';
import '../domain/review_models.dart';

class ReviewCard extends ConsumerStatefulWidget {
  const ReviewCard({
    super.key,
    required this.review,
    this.userId,
  });

  final ProviderReviewItem review;
  final String? userId;

  @override
  ConsumerState<ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends ConsumerState<ReviewCard> {
  String? _userVote;
  int _helpfulCount = 0;
  int _notHelpfulCount = 0;
  bool _loadingVote = false;

  @override
  void initState() {
    super.initState();
    _helpfulCount = widget.review.helpfulCount;
    _notHelpfulCount = widget.review.notHelpfulCount;
    if (widget.userId != null) {
      _loadVoteStatus();
    }
  }

  Future<void> _loadVoteStatus() async {
    try {
      final status = await ref.read(reviewRepositoryProvider).getVoteStatus(widget.review.id);
      if (!mounted) return;
      setState(() {
        _userVote = status['user_vote'] as String?;
        _helpfulCount = (status['helpful_count'] as num?)?.toInt() ?? _helpfulCount;
        _notHelpfulCount = (status['not_helpful_count'] as num?)?.toInt() ?? _notHelpfulCount;
      });
    } catch (_) {}
  }

  Future<void> _toggleVote(String vote) async {
    if (_loadingVote) return;
    setState(() => _loadingVote = true);
    try {
      final result = await ref.read(reviewRepositoryProvider).toggleVote(widget.review.id, vote);
      if (!mounted) return;
      final action = result['action'] as String?;
      setState(() {
        _loadingVote = false;
        if (action == 'removed') {
          if (_userVote == 'helpful') _helpfulCount--;
          if (_userVote == 'not_helpful') _notHelpfulCount--;
          _userVote = null;
        } else if (action == 'added') {
          if (vote == 'helpful') {
            _helpfulCount++;
            _userVote = 'helpful';
          } else {
            _notHelpfulCount++;
            _userVote = 'not_helpful';
          }
        } else if (action == 'updated') {
          if (vote == 'helpful') {
            if (_userVote == 'not_helpful') _notHelpfulCount--;
            _helpfulCount++;
          } else {
            if (_userVote == 'helpful') _helpfulCount--;
            _notHelpfulCount++;
          }
          _userVote = vote;
        }
      });
    } catch (_) {
      if (mounted) setState(() => _loadingVote = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final review = widget.review;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _StarRating(rating: review.rating),
                const SizedBox(width: 8),
                if (review.isVerifiedPurchase)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.verifiedSoft,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified, size: 12, color: AppColors.verified),
                        SizedBox(width: 3),
                        Text('Verified Purchase',
                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.verified)),
                      ],
                    ),
                  ),
                const Spacer(),
                if (review.formattedDate.isNotEmpty)
                  Text(review.formattedDate,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkFaint, fontSize: 11)),
              ],
            ),
            if (review.comment != null && review.comment!.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(review.comment!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4)),
            ],
            if (review.photos.isNotEmpty) ...[
              const SizedBox(height: 10),
              SizedBox(
                height: 72,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: review.photos.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (context, index) {
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        review.photos[index],
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(
                          width: 72,
                          height: 72,
                          color: AppColors.surfaceAlt,
                          child: const Icon(Icons.broken_image_outlined, size: 24, color: AppColors.inkFaint),
                        ),
                        loadingBuilder: (context, child, loadingProgress) {
                          if (loadingProgress == null) return child;
                          return Container(
                            width: 72,
                            height: 72,
                            color: AppColors.surfaceAlt,
                            child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: 10),
            Row(
              children: [
                _VoteButton(
                  icon: Icons.thumb_up_off_alt,
                  activeIcon: Icons.thumb_up_alt,
                  count: _helpfulCount,
                  isActive: _userVote == 'helpful',
                  loading: _loadingVote,
                  onPressed: () => _toggleVote('helpful'),
                ),
                const SizedBox(width: 12),
                _VoteButton(
                  icon: Icons.thumb_down_off_alt,
                  activeIcon: Icons.thumb_down_alt,
                  count: _notHelpfulCount,
                  isActive: _userVote == 'not_helpful',
                  loading: _loadingVote,
                  onPressed: () => _toggleVote('not_helpful'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StarRating extends StatelessWidget {
  const _StarRating({required this.rating});

  final double rating;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final filled = i < rating.round();
        return Icon(
          filled ? Icons.star_rounded : Icons.star_border_rounded,
          size: 16,
          color: filled ? AppColors.warm : AppColors.inkFaint,
        );
      }),
    );
  }
}

class _VoteButton extends StatelessWidget {
  const _VoteButton({
    required this.icon,
    required this.activeIcon,
    required this.count,
    required this.isActive,
    required this.loading,
    required this.onPressed,
  });

  final IconData icon;
  final IconData activeIcon;
  final int count;
  final bool isActive;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isActive ? AppColors.surfaceTint : AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2))
            else
              Icon(
                isActive ? activeIcon : icon,
                size: 14,
                color: isActive ? AppColors.primary : AppColors.inkSubtle,
              ),
            if (count > 0) ...[
              const SizedBox(width: 4),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                  color: isActive ? AppColors.primary : AppColors.inkSubtle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
