import 'package:flutter/material.dart' hide ConnectionState;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/serviq_models.dart';

final serviqMockStoreProvider =
    NotifierProvider<ServiqMockStore, ServiqMockState>(ServiqMockStore.new);

class ServiqMockStore extends Notifier<ServiqMockState> {
  @override
  ServiqMockState build() => _seedState();

  void toggleSavedListing(String listingId) {
    final listings = state.listings
        .map(
          (item) =>
              item.id == listingId ? item.copyWith(saved: !item.saved) : item,
        )
        .toList();

    state = state.copyWith(
      listings: listings,
      profile: state.profile.copyWith(
        savedListingsCount: listings.where((item) => item.saved).length,
      ),
    );
  }

  void toggleSavedPerson(String personId) {
    final people = state.people
        .map(
          (item) =>
              item.id == personId ? item.copyWith(saved: !item.saved) : item,
        )
        .toList();

    state = state.copyWith(
      people: people,
      profile: state.profile.copyWith(
        savedPeopleCount: people.where((item) => item.saved).length,
      ),
    );
  }

  void sendConnectionRequest(String personId) {
    final requestId = 'cr-${DateTime.now().millisecondsSinceEpoch}';
    final people = state.people
        .map(
          (person) => person.id == personId
              ? person.copyWith(
                  connectionState: PeopleConnectionState.requested,
                )
              : person,
        )
        .toList();

    final requests = [
      ConnectionRequest(
        id: requestId,
        personId: personId,
        direction: ConnectionRequestDirection.outgoing,
        message: 'Sent from ServiQ mobile',
        createdAt: DateTime.now(),
      ),
      ...state.connectionRequests,
    ];

    state = state.copyWith(
      people: people,
      connectionRequests: requests,
      notifications: [
        AppNotification(
          id: 'n-$requestId',
          title: 'Connection request sent',
          message: 'We will notify you when they respond.',
          kind: NotificationKind.connection,
          priority: NotificationPriority.normal,
          createdAt: DateTime.now(),
          read: false,
          route: '/app/people',
          actionLabel: 'View people',
          entityId: personId,
        ),
        ...state.notifications,
      ],
    );
  }

  void acceptIncomingRequest(String requestId) {
    final request = state.connectionRequests.firstWhere(
      (item) => item.id == requestId,
    );
    final updatedRequests = state.connectionRequests
        .where((item) => item.id != requestId)
        .toList();
    final people = state.people
        .map(
          (person) => person.id == request.personId
              ? person.copyWith(
                  connectionState: PeopleConnectionState.connected,
                )
              : person,
        )
        .toList();

    state = state.copyWith(
      people: people,
      connectionRequests: updatedRequests,
      profile: state.profile.copyWith(
        connectionsCount: people
            .where(
              (item) => item.connectionState == PeopleConnectionState.connected,
            )
            .length,
      ),
      notifications: [
        AppNotification(
          id: 'n-accepted-$requestId',
          title: 'Connection accepted',
          message: 'You are now connected and can coordinate directly.',
          kind: NotificationKind.connection,
          priority: NotificationPriority.normal,
          createdAt: DateTime.now(),
          read: false,
          route: '/app/chat',
          actionLabel: 'Open chat',
          entityId: request.personId,
        ),
        ...state.notifications,
      ],
    );
  }

  void removeConnection(String personId) {
    final people = state.people
        .map(
          (person) => person.id == personId
              ? person.copyWith(connectionState: PeopleConnectionState.none)
              : person,
        )
        .toList();

    final requests = state.connectionRequests
        .where((item) => item.personId != personId)
        .toList();

    state = state.copyWith(
      people: people,
      connectionRequests: requests,
      profile: state.profile.copyWith(
        connectionsCount: people
            .where(
              (item) => item.connectionState == PeopleConnectionState.connected,
            )
            .length,
      ),
    );
  }

  void blockPerson(String personId) {
    final people = state.people
        .map(
          (person) => person.id == personId
              ? person.copyWith(connectionState: PeopleConnectionState.blocked)
              : person,
        )
        .toList();
    final blocked = [...state.settings.blockedUserIds];
    if (!blocked.contains(personId)) {
      blocked.add(personId);
    }

    state = state.copyWith(
      people: people,
      settings: state.settings.copyWith(blockedUserIds: blocked),
    );
  }

  void updateTaskStatus(TaskItem task, TaskStatus nextStatus) {
    final now = DateTime.now();
    final nextTimeline = [
      TaskTimelineEntry(
        id: 'auto-$nextStatus',
        title: nextStatus.label,
        subtitle: 'Updated from the mobile action center.',
        time: now,
        isComplete: true,
        isCurrent: true,
        icon: Icons.check_circle_outline_rounded,
      ),
      ...task.timeline.map(
        (entry) => TaskTimelineEntry(
          id: entry.id,
          title: entry.title,
          subtitle: entry.subtitle,
          time: entry.time,
          isComplete: true,
          isCurrent: false,
          icon: entry.icon,
        ),
      ),
    ];

    final tasks = state.tasks
        .map(
          (item) => item.id == task.id
              ? item.copyWith(
                  status: nextStatus,
                  timeline: nextTimeline,
                  updatedAt: now,
                )
              : item,
        )
        .toList();

    state = state.copyWith(
      tasks: tasks,
      profile: state.profile.copyWith(
        activeTasksCount: tasks
            .where(
              (item) =>
                  item.status != TaskStatus.completed &&
                  item.status != TaskStatus.cancelled,
            )
            .length,
        completedTasksCount: tasks
            .where((item) => item.status == TaskStatus.completed)
            .length,
      ),
      notifications: [
        AppNotification(
          id: 'task-${task.id}-${now.millisecondsSinceEpoch}',
          title: 'Task updated',
          message: '${task.title} moved to ${nextStatus.label.toLowerCase()}.',
          kind: NotificationKind.task,
          priority: nextStatus == TaskStatus.completed
              ? NotificationPriority.normal
              : NotificationPriority.high,
          createdAt: now,
          read: false,
          route: '/app/tasks/${task.id}',
          actionLabel: 'Open task',
          entityId: task.id,
        ),
        ...state.notifications,
      ],
    );
  }

  void markThreadRead(String threadId) {
    state = state.copyWith(
      threads: state.threads
          .map(
            (thread) => thread.id == threadId
                ? thread.copyWith(unreadCount: 0)
                : thread,
          )
          .toList(),
    );
  }

  void toggleThreadPin(String threadId) {
    state = state.copyWith(
      threads: state.threads
          .map(
            (thread) => thread.id == threadId
                ? thread.copyWith(pinned: !thread.pinned)
                : thread,
          )
          .toList(),
    );
  }

  void sendMessage(String threadId, String text) {
    final now = DateTime.now();
    final message = ChatMessage(
      id: 'm-${now.microsecondsSinceEpoch}',
      threadId: threadId,
      senderId: state.profile.id,
      senderName: state.profile.name,
      text: text,
      sentAt: now,
      isMine: true,
      isSystem: false,
    );

    final threadMessages = [
      ...(state.messagesByThreadId[threadId] ?? []),
      message,
    ];
    final messagesByThread = {
      ...state.messagesByThreadId,
      threadId: threadMessages,
    };
    final threads =
        state.threads
            .map(
              (item) => item.id == threadId
                  ? item.copyWith(
                      lastMessagePreview: text,
                      lastMessageAt: now,
                      unreadCount: 0,
                    )
                  : item,
            )
            .toList()
          ..sort((a, b) {
            if (a.pinned != b.pinned) {
              return a.pinned ? -1 : 1;
            }
            return b.lastMessageAt.compareTo(a.lastMessageAt);
          });

    state = state.copyWith(
      messagesByThreadId: messagesByThread,
      threads: threads,
    );
  }

  void markNotificationRead(String id) {
    state = state.copyWith(
      notifications: state.notifications
          .map((item) => item.id == id ? item.copyWith(read: true) : item)
          .toList(),
    );
  }

  void markAllNotificationsRead() {
    state = state.copyWith(
      notifications: state.notifications
          .map((item) => item.copyWith(read: true))
          .toList(),
    );
  }

  void updateProfile({
    required String name,
    required String headline,
    required String bio,
    required String locality,
    required List<String> serviceCategories,
  }) {
    final profile = state.profile.copyWith(
      name: name,
      headline: headline,
      bio: bio,
      locality: locality,
      serviceCategories: serviceCategories,
      completionPercent: _calculateCompletion(
        name: name,
        headline: headline,
        bio: bio,
        locality: locality,
        categories: serviceCategories,
      ),
    );
    state = state.copyWith(profile: profile);
  }

  void updateSettings(AppSettingsModel settings) {
    state = state.copyWith(settings: settings);
  }

  void addRecentSearch(String query) {
    final normalized = query.trim();
    if (normalized.isEmpty) {
      return;
    }
    final next = [
      normalized,
      ...state.recentSearches.where(
        (item) => item.toLowerCase() != normalized.toLowerCase(),
      ),
    ].take(8).toList();
    state = state.copyWith(recentSearches: next);
  }

  void clearRecentSearches() {
    state = state.copyWith(recentSearches: const []);
  }

  int _calculateCompletion({
    required String name,
    required String headline,
    required String bio,
    required String locality,
    required List<String> categories,
  }) {
    var score = 45;
    if (name.trim().isNotEmpty) {
      score += 10;
    }
    if (headline.trim().isNotEmpty) {
      score += 12;
    }
    if (bio.trim().length >= 32) {
      score += 12;
    }
    if (locality.trim().isNotEmpty) {
      score += 10;
    }
    if (categories.isNotEmpty) {
      score += 11;
    }
    return score.clamp(0, 100).toInt();
  }
}

ServiqMockState _seedState() {
  final now = DateTime.now();

  final categories = [
    const ExploreCategory(
      id: 'cleaning',
      label: 'Cleaning',
      icon: Icons.cleaning_services_rounded,
      activeCount: 42,
    ),
    const ExploreCategory(
      id: 'repairs',
      label: 'Repairs',
      icon: Icons.build_circle_outlined,
      activeCount: 29,
    ),
    const ExploreCategory(
      id: 'tutors',
      label: 'Tutors',
      icon: Icons.menu_book_rounded,
      activeCount: 18,
    ),
    const ExploreCategory(
      id: 'moving',
      label: 'Moving',
      icon: Icons.local_shipping_outlined,
      activeCount: 13,
    ),
  ];

  final listings = [
    ExploreItem(
      id: 'e1',
      title: 'Need AC repair before 7 PM',
      summary:
          'Split AC stopped cooling. Looking for a verified technician nearby.',
      type: ExploreItemType.request,
      category: 'Repairs',
      locality: 'Indiranagar',
      distanceKm: 1.2,
      priceLabel: 'Budget INR 1,200',
      postedAt: now.subtract(const Duration(minutes: 12)),
      providerId: 'p1',
      providerName: 'Aman HVAC',
      trustNote: 'ID verified, 98% response rate',
      socialProof: '7 nearby providers viewed this',
      tags: const ['Urgent', 'Today', 'Home'],
      urgent: true,
      verified: true,
      saved: true,
      rating: 4.9,
      reviewCount: 88,
      responseTimeMinutes: 6,
      mutualConnections: 2,
    ),
    ExploreItem(
      id: 'e2',
      title: 'Recurring home deep-cleaning slot',
      summary:
          'Monthly subscription-friendly opening for a premium apartment client.',
      type: ExploreItemType.opportunity,
      category: 'Cleaning',
      locality: 'Koramangala',
      distanceKm: 2.8,
      priceLabel: 'Earn INR 2,500',
      postedAt: now.subtract(const Duration(hours: 1, minutes: 10)),
      providerId: 'p2',
      providerName: 'Nisha Clean Co.',
      trustNote: 'Repeat requester, 4.8 satisfaction score',
      socialProof: '3 helpers shortlisted already',
      tags: const ['Repeat work', 'Premium'],
      urgent: false,
      verified: true,
      saved: false,
      rating: 4.8,
      reviewCount: 46,
      responseTimeMinutes: 14,
      mutualConnections: 1,
    ),
    ExploreItem(
      id: 'e3',
      title: 'Math tutor for class 8 exam sprint',
      summary:
          'Evening sessions needed this week. Preference for someone local and patient.',
      type: ExploreItemType.request,
      category: 'Tutors',
      locality: 'HSR Layout',
      distanceKm: 3.6,
      priceLabel: 'Budget INR 800 / session',
      postedAt: now.subtract(const Duration(hours: 4)),
      providerId: 'p3',
      providerName: 'Rahul Learning Lab',
      trustNote: 'Mutuals through school network',
      socialProof: 'Parents nearby saved this',
      tags: const ['Students', 'After school'],
      urgent: false,
      verified: false,
      saved: false,
      rating: 4.7,
      reviewCount: 19,
      responseTimeMinutes: 22,
      mutualConnections: 3,
    ),
    ExploreItem(
      id: 'e4',
      title: 'Weekend move-out helper needed',
      summary:
          'Need two people for packing and loading. Lift available, 2 BHK apartment.',
      type: ExploreItemType.opportunity,
      category: 'Moving',
      locality: 'Domlur',
      distanceKm: 4.1,
      priceLabel: 'Earn INR 3,400',
      postedAt: now.subtract(const Duration(hours: 8)),
      providerId: 'p4',
      providerName: 'ShiftSure Crew',
      trustNote: 'Well-rated requester and clear timeline',
      socialProof: 'Trending with helpers nearby',
      tags: const ['Weekend', '2 helpers'],
      urgent: true,
      verified: true,
      saved: true,
      rating: 4.6,
      reviewCount: 32,
      responseTimeMinutes: 11,
      mutualConnections: 0,
    ),
  ];

  final people = [
    PersonSummary(
      id: 'p1',
      name: 'Aman Jain',
      headline: 'AC and appliance repair specialist',
      bio:
          'Fast diagnostics, evening home visits, and clean completion updates.',
      locality: 'Indiranagar',
      distanceKm: 1.1,
      responseTimeMinutes: 7,
      rating: 4.9,
      reviewCount: 88,
      completionPercent: 96,
      trustScore: 93,
      jobsCompleted: 214,
      serviceCategories: const ['Repairs', 'Appliances'],
      roles: const [AppUserMode.provider],
      verificationLevel: VerificationLevel.elite,
      connectionState: PeopleConnectionState.connected,
      saved: true,
      isOnline: true,
      mutualConnections: 2,
    ),
    PersonSummary(
      id: 'p2',
      name: 'Nisha Rao',
      headline: 'Premium home cleaning and recurring upkeep',
      bio:
          'Trusted by apartment communities for tidy handoffs and predictable timing.',
      locality: 'Koramangala',
      distanceKm: 2.2,
      responseTimeMinutes: 11,
      rating: 4.8,
      reviewCount: 46,
      completionPercent: 92,
      trustScore: 89,
      jobsCompleted: 132,
      serviceCategories: const ['Cleaning'],
      roles: const [AppUserMode.provider],
      verificationLevel: VerificationLevel.verified,
      connectionState: PeopleConnectionState.incoming,
      saved: false,
      isOnline: false,
      mutualConnections: 4,
    ),
    PersonSummary(
      id: 'p3',
      name: 'Rahul Verma',
      headline: 'Math tutor and after-school mentor',
      bio:
          'Clear lesson plans, calm communication, and family-safe coordination.',
      locality: 'HSR Layout',
      distanceKm: 3.5,
      responseTimeMinutes: 18,
      rating: 4.7,
      reviewCount: 19,
      completionPercent: 84,
      trustScore: 77,
      jobsCompleted: 48,
      serviceCategories: const ['Tutors'],
      roles: const [AppUserMode.provider, AppUserMode.seeker],
      verificationLevel: VerificationLevel.basic,
      connectionState: PeopleConnectionState.none,
      saved: true,
      isOnline: true,
      mutualConnections: 3,
    ),
    PersonSummary(
      id: 'p4',
      name: 'Megha Singh',
      headline: 'Community connector and errands helper',
      bio: 'Known in the neighborhood for reliable handoffs and fast replies.',
      locality: 'Domlur',
      distanceKm: 4.4,
      responseTimeMinutes: 9,
      rating: 4.9,
      reviewCount: 29,
      completionPercent: 88,
      trustScore: 85,
      jobsCompleted: 71,
      serviceCategories: const ['Errands', 'Moving'],
      roles: const [AppUserMode.dual],
      verificationLevel: VerificationLevel.verified,
      connectionState: PeopleConnectionState.requested,
      saved: false,
      isOnline: false,
      mutualConnections: 5,
    ),
  ];

  final tasks = [
    TaskItem(
      id: 't1',
      title: 'AC repair for 2 BHK apartment',
      summary: 'Customer confirmed urgent cooling issue in living room.',
      category: 'Repairs',
      locality: 'Indiranagar',
      distanceKm: 1.2,
      budgetLabel: 'INR 1,200',
      status: TaskStatus.inProgress,
      priority: TaskPriority.urgent,
      role: TaskRoleView.provider,
      customerName: 'Karan Malhotra',
      providerName: 'You',
      linkedThreadId: 'th1',
      attachmentCount: 2,
      offerCount: 1,
      unreadChatCount: 0,
      timeline: [
        TaskTimelineEntry(
          id: 'tt1',
          title: 'Work started',
          subtitle: 'Repair has begun on-site.',
          time: now.subtract(const Duration(minutes: 24)),
          isComplete: true,
          isCurrent: true,
          icon: Icons.build_circle_outlined,
        ),
        TaskTimelineEntry(
          id: 'tt2',
          title: 'Arrived',
          subtitle: 'Provider reached the location.',
          time: now.subtract(const Duration(minutes: 42)),
          isComplete: true,
          isCurrent: false,
          icon: Icons.location_on_outlined,
        ),
      ],
      offers: const [],
      trustNote: 'Verified address and trusted payer',
      updatedAt: now.subtract(const Duration(minutes: 24)),
      scheduledFor: now.subtract(const Duration(minutes: 50)),
    ),
    TaskItem(
      id: 't2',
      title: 'Tutor shortlist for exam week',
      summary: 'Three providers replied. Choose one before tomorrow evening.',
      category: 'Tutors',
      locality: 'HSR Layout',
      distanceKm: 3.6,
      budgetLabel: 'INR 800 / session',
      status: TaskStatus.quoted,
      priority: TaskPriority.normal,
      role: TaskRoleView.requester,
      customerName: 'You',
      providerName: 'Multiple providers',
      linkedThreadId: 'th2',
      attachmentCount: 1,
      offerCount: 3,
      unreadChatCount: 2,
      timeline: [
        TaskTimelineEntry(
          id: 'tt3',
          title: 'Offers received',
          subtitle: 'Three local tutors responded with timing and rates.',
          time: now.subtract(const Duration(hours: 3)),
          isComplete: true,
          isCurrent: true,
          icon: Icons.local_offer_outlined,
        ),
      ],
      offers: const [
        TaskOffer(
          id: 'o1',
          providerId: 'p3',
          providerName: 'Rahul Verma',
          amountLabel: 'INR 800 / session',
          etaLabel: 'Available tonight',
          trustNote: '3 mutuals and strong parent reviews',
        ),
        TaskOffer(
          id: 'o2',
          providerId: 'p5',
          providerName: 'Priya Menon',
          amountLabel: 'INR 950 / session',
          etaLabel: 'Available tomorrow',
          trustNote: 'Background verified',
        ),
      ],
      trustNote: 'Strong neighborhood response rate',
      updatedAt: now.subtract(const Duration(hours: 3)),
    ),
    TaskItem(
      id: 't3',
      title: 'Monthly home deep-cleaning',
      summary: 'Recurring task accepted with next visit scheduled.',
      category: 'Cleaning',
      locality: 'Koramangala',
      distanceKm: 2.9,
      budgetLabel: 'INR 2,500',
      status: TaskStatus.scheduled,
      priority: TaskPriority.normal,
      role: TaskRoleView.requester,
      customerName: 'You',
      providerName: 'Nisha Rao',
      linkedThreadId: 'th3',
      attachmentCount: 0,
      offerCount: 1,
      unreadChatCount: 0,
      timeline: [
        TaskTimelineEntry(
          id: 'tt4',
          title: 'Scheduled',
          subtitle: 'Provider confirmed Saturday 10:00 AM.',
          time: now.subtract(const Duration(hours: 10)),
          isComplete: true,
          isCurrent: true,
          icon: Icons.calendar_month_outlined,
        ),
      ],
      offers: const [],
      trustNote: 'Repeat provider with premium badge',
      updatedAt: now.subtract(const Duration(hours: 10)),
      scheduledFor: now.add(const Duration(days: 2)),
    ),
    TaskItem(
      id: 't4',
      title: 'Weekend move-out support',
      summary: 'Packing and loading completed smoothly.',
      category: 'Moving',
      locality: 'Domlur',
      distanceKm: 4.1,
      budgetLabel: 'INR 3,400',
      status: TaskStatus.completed,
      priority: TaskPriority.normal,
      role: TaskRoleView.provider,
      customerName: 'Ananya Roy',
      providerName: 'You',
      linkedThreadId: 'th4',
      attachmentCount: 4,
      offerCount: 0,
      unreadChatCount: 0,
      timeline: [
        TaskTimelineEntry(
          id: 'tt5',
          title: 'Completed',
          subtitle: 'Requester marked the job done.',
          time: now.subtract(const Duration(days: 1)),
          isComplete: true,
          isCurrent: true,
          icon: Icons.verified_rounded,
        ),
      ],
      offers: const [],
      trustNote: '5-star follow-through',
      updatedAt: now.subtract(const Duration(days: 1)),
    ),
  ];

  final profile = ProfileSummary(
    id: 'u1',
    name: 'Riya Sharma',
    headline:
        'Trusted local helper for repairs, errands, and neighborhood coordination',
    bio:
        'I use ServiQ both to get things done nearby and to help local families with quick, reliable support.',
    locality: 'Indiranagar, Bengaluru',
    languageCode: 'en',
    availabilityLabel: 'Weekdays after 6 PM, weekends flexible',
    roles: const [AppUserMode.dual],
    verificationLevel: VerificationLevel.verified,
    completionPercent: 86,
    responseRate: 94,
    responseTimeMinutes: 8,
    rating: 4.9,
    reviewCount: 46,
    serviceCategories: const ['Repairs', 'Errands', 'Tutors'],
    portfolio: const [
      PortfolioEntry(
        id: 'pf1',
        title: 'Apartment setup help',
        caption: 'Quick move-in support for a family nearby.',
      ),
      PortfolioEntry(
        id: 'pf2',
        title: 'Exam-week tutoring sprint',
        caption: 'Organized tutor handoff and daily session updates.',
      ),
    ],
    reviews: const [
      ReviewSnippet(
        id: 'rv1',
        author: 'Karan M.',
        comment:
            'Fast response, very reliable, and communication stayed clear.',
        rating: 5,
      ),
      ReviewSnippet(
        id: 'rv2',
        author: 'Ananya R.',
        comment: 'Strong follow-through and very easy to coordinate with.',
        rating: 4.8,
      ),
    ],
    savedListingsCount: listings.where((item) => item.saved).length,
    savedPeopleCount: people.where((item) => item.saved).length,
    activeTasksCount: tasks
        .where(
          (item) =>
              item.status != TaskStatus.completed &&
              item.status != TaskStatus.cancelled,
        )
        .length,
    completedTasksCount: tasks
        .where((item) => item.status == TaskStatus.completed)
        .length,
    connectionsCount: people
        .where(
          (item) => item.connectionState == PeopleConnectionState.connected,
        )
        .length,
  );

  final settings = AppSettingsModel(
    locationEnabled: true,
    languageCode: 'en',
    themeReady: true,
    allowAnalytics: true,
    blockedUserIds: const [],
    notificationPreferences: const NotificationPreferences(
      taskUpdates: true,
      connectionRequests: true,
      messages: true,
      reminders: true,
      trustAlerts: true,
      promotions: false,
    ),
    privacySettings: const PrivacySettings(
      profileVisibility: ProfileVisibility.connections,
      showPreciseLocation: false,
      showMutualConnections: true,
      allowDirectMessages: true,
      showOnlineStatus: true,
    ),
  );

  final threads = [
    ChatThread(
      id: 'th1',
      counterpartId: 'c1',
      counterpartName: 'Karan Malhotra',
      subtitle: 'AC repair task',
      linkedTaskId: 't1',
      lastMessagePreview: 'Please call once the compressor check is done.',
      lastMessageAt: now.subtract(const Duration(minutes: 3)),
      unreadCount: 0,
      pinned: true,
      verified: true,
      online: true,
      safetyLabel: 'Task-linked and verified',
    ),
    ChatThread(
      id: 'th2',
      counterpartId: 'p3',
      counterpartName: 'Rahul Verma',
      subtitle: 'Tutor quote',
      linkedTaskId: 't2',
      lastMessagePreview: 'I can start today at 7 PM if that helps.',
      lastMessageAt: now.subtract(const Duration(minutes: 27)),
      unreadCount: 2,
      pinned: false,
      verified: false,
      online: true,
      safetyLabel: '2 mutual connections',
    ),
    ChatThread(
      id: 'th3',
      counterpartId: 'p2',
      counterpartName: 'Nisha Rao',
      subtitle: 'Deep-cleaning schedule',
      linkedTaskId: 't3',
      lastMessagePreview: 'Saturday 10 AM is locked in.',
      lastMessageAt: now.subtract(const Duration(hours: 2)),
      unreadCount: 0,
      pinned: false,
      verified: true,
      online: false,
      safetyLabel: 'Premium verified provider',
    ),
  ];

  final messagesByThreadId = {
    'th1': [
      ChatMessage(
        id: 'm1',
        threadId: 'th1',
        senderId: 'c1',
        senderName: 'Karan',
        text: 'The AC is still not cooling in the bedroom too.',
        sentAt: now.subtract(const Duration(minutes: 28)),
        isMine: false,
        isSystem: false,
      ),
      ChatMessage(
        id: 'm2',
        threadId: 'th1',
        senderId: 'u1',
        senderName: 'You',
        text: 'I am checking the compressor now and will update in 10 minutes.',
        sentAt: now.subtract(const Duration(minutes: 18)),
        isMine: true,
        isSystem: false,
      ),
      ChatMessage(
        id: 'm3',
        threadId: 'th1',
        senderId: 'system',
        senderName: 'ServiQ',
        text: 'Task status changed to in progress.',
        sentAt: now.subtract(const Duration(minutes: 17)),
        isMine: false,
        isSystem: true,
      ),
    ],
    'th2': [
      ChatMessage(
        id: 'm4',
        threadId: 'th2',
        senderId: 'p3',
        senderName: 'Rahul',
        text: 'I can start today at 7 PM if that helps.',
        sentAt: now.subtract(const Duration(minutes: 27)),
        isMine: false,
        isSystem: false,
      ),
      ChatMessage(
        id: 'm5',
        threadId: 'th2',
        senderId: 'p3',
        senderName: 'Rahul',
        text: 'I also have a quick revision worksheet ready.',
        sentAt: now.subtract(const Duration(minutes: 21)),
        isMine: false,
        isSystem: false,
      ),
    ],
    'th3': [
      ChatMessage(
        id: 'm6',
        threadId: 'th3',
        senderId: 'u1',
        senderName: 'You',
        text: 'Saturday 10 AM works for me. Please bring eco-safe products.',
        sentAt: now.subtract(const Duration(hours: 3)),
        isMine: true,
        isSystem: false,
      ),
      ChatMessage(
        id: 'm7',
        threadId: 'th3',
        senderId: 'p2',
        senderName: 'Nisha',
        text: 'Done. I will share arrival updates in the thread.',
        sentAt: now.subtract(const Duration(hours: 2)),
        isMine: false,
        isSystem: false,
      ),
    ],
  };

  final notifications = [
    AppNotification(
      id: 'n1',
      title: 'Two new tutor responses',
      message: 'Your exam-week task has fresh offers waiting.',
      kind: NotificationKind.providerResponse,
      priority: NotificationPriority.high,
      createdAt: now.subtract(const Duration(minutes: 22)),
      read: false,
      route: '/app/tasks/t2',
      actionLabel: 'Review offers',
      entityId: 't2',
    ),
    AppNotification(
      id: 'n2',
      title: 'Incoming connection request',
      message: 'Nisha Rao wants to connect for faster recurring coordination.',
      kind: NotificationKind.connection,
      priority: NotificationPriority.normal,
      createdAt: now.subtract(const Duration(hours: 1)),
      read: false,
      route: '/app/people',
      actionLabel: 'Open people',
      entityId: 'p2',
    ),
    AppNotification(
      id: 'n3',
      title: 'Task reminder',
      message: 'Saturday cleaning is coming up in 2 days.',
      kind: NotificationKind.reminder,
      priority: NotificationPriority.normal,
      createdAt: now.subtract(const Duration(hours: 2)),
      read: true,
      route: '/app/tasks/t3',
      actionLabel: 'View schedule',
      entityId: 't3',
    ),
    AppNotification(
      id: 'n4',
      title: 'Profile trust boost available',
      message: 'Add one more work example to move above 90% completion.',
      kind: NotificationKind.safety,
      priority: NotificationPriority.low,
      createdAt: now.subtract(const Duration(hours: 5)),
      read: true,
      route: '/app/profile/edit',
      actionLabel: 'Update profile',
      entityId: 'u1',
    ),
  ];

  final connectionRequests = [
    ConnectionRequest(
      id: 'cr1',
      personId: 'p2',
      direction: ConnectionRequestDirection.incoming,
      message: 'Would love to coordinate directly for recurring bookings.',
      createdAt: now.subtract(const Duration(hours: 1, minutes: 20)),
    ),
    ConnectionRequest(
      id: 'cr2',
      personId: 'p4',
      direction: ConnectionRequestDirection.outgoing,
      message: 'Let us stay connected for errands and moving help nearby.',
      createdAt: now.subtract(const Duration(hours: 7)),
    ),
  ];

  return ServiqMockState(
    locationTitle: 'Indiranagar, Bengaluru',
    categories: categories,
    listings: listings,
    people: people,
    connectionRequests: connectionRequests,
    tasks: tasks,
    profile: profile,
    settings: settings,
    threads: threads,
    messagesByThreadId: messagesByThreadId,
    notifications: notifications,
    recentSearches: const ['ac repair', 'math tutor', 'cleaning'],
  );
}
