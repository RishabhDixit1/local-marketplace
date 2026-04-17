class MobilePeopleSnapshot {
  const MobilePeopleSnapshot({
    required this.currentUserId,
    required this.people,
  });

  final String currentUserId;
  final List<MobilePersonItem> people;
}

class MobilePersonItem {
  const MobilePersonItem({
    required this.id,
    required this.name,
    required this.roleLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.bio,
    required this.serviceCount,
    required this.productCount,
    required this.postCount,
    required this.completedJobs,
    required this.openLeads,
    required this.rating,
    required this.reviewCount,
    required this.online,
    required this.isCurrentUser,
  });

  final String id;
  final String name;
  final String roleLabel;
  final String locationLabel;
  final String availabilityLabel;
  final String bio;
  final int serviceCount;
  final int productCount;
  final int postCount;
  final int completedJobs;
  final int openLeads;
  final double rating;
  final int reviewCount;
  final bool online;
  final bool isCurrentUser;

  String get initials {
    final parts = name
        .split(RegExp(r'\s+'))
        .map((entry) => entry.trim())
        .where((entry) => entry.isNotEmpty)
        .take(2)
        .toList();
    if (parts.isEmpty) {
      return 'S';
    }
    return parts.map((entry) => entry[0].toUpperCase()).join();
  }

  String get ratingLabel =>
      reviewCount == 0 ? 'No reviews yet' : rating.toStringAsFixed(1);

  String get statsSummary {
    final entries = <String>[
      if (serviceCount > 0) '$serviceCount services',
      if (productCount > 0) '$productCount products',
      if (completedJobs > 0) '$completedJobs completed',
    ];
    if (entries.isEmpty) {
      return 'Building presence in ServiQ';
    }
    return entries.join(' • ');
  }
}
