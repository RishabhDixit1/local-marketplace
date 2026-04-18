import 'package:flutter/material.dart';

import '../../features/feed/domain/feed_snapshot.dart';
import 'feed_card.dart';

class RequestCard extends StatelessWidget {
  const RequestCard({
    super.key,
    required this.item,
    this.onOpen,
    this.onMessage,
  });

  final MobileFeedItem item;
  final VoidCallback? onOpen;
  final VoidCallback? onMessage;

  @override
  Widget build(BuildContext context) {
    return FeedCard(
      item: item,
      onPrimaryTap: onOpen,
      onSecondaryTap: onMessage,
      primaryLabel: 'Open request',
      secondaryLabel: 'Contact',
    );
  }
}
