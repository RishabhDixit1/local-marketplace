import 'package:flutter/material.dart';

enum AppUserMode {
  seeker,
  provider,
  dual;

  String get label => switch (this) {
    AppUserMode.seeker => 'Seeker',
    AppUserMode.provider => 'Provider',
    AppUserMode.dual => 'Dual role',
  };
}

enum VerificationLevel {
  unverified,
  basic,
  verified,
  elite;

  String get label => switch (this) {
    VerificationLevel.unverified => 'Unverified',
    VerificationLevel.basic => 'Basic verified',
    VerificationLevel.verified => 'Verified',
    VerificationLevel.elite => 'Elite verified',
  };
}

enum ExploreItemType {
  request,
  opportunity,
  service;

  String get label => switch (this) {
    ExploreItemType.request => 'Need nearby',
    ExploreItemType.opportunity => 'Earn opportunity',
    ExploreItemType.service => 'Featured provider',
  };
}

enum ExploreSort {
  relevance,
  nearest,
  freshest,
  urgent,
  trust;

  String get label => switch (this) {
    ExploreSort.relevance => 'Relevance',
    ExploreSort.nearest => 'Nearest',
    ExploreSort.freshest => 'Newest',
    ExploreSort.urgent => 'Urgent first',
    ExploreSort.trust => 'Most trusted',
  };
}

enum PeopleConnectionState {
  none,
  requested,
  incoming,
  connected,
  blocked;

  String get label => switch (this) {
        PeopleConnectionState.none => 'Connect',
        PeopleConnectionState.requested => 'Requested',
        PeopleConnectionState.incoming => 'Respond',
        PeopleConnectionState.connected => 'Connected',
        PeopleConnectionState.blocked => 'Blocked',
      };
}

enum ConnectionRequestDirection { incoming, outgoing }

enum TaskStatus {
  open,
  quoted,
  scheduled,
  inProgress,
  completed,
  cancelled;

  String get label => switch (this) {
    TaskStatus.open => 'Open',
    TaskStatus.quoted => 'Quotes',
    TaskStatus.scheduled => 'Scheduled',
    TaskStatus.inProgress => 'In progress',
    TaskStatus.completed => 'Completed',
    TaskStatus.cancelled => 'Cancelled',
  };
}

enum TaskPriority {
  low,
  normal,
  urgent;

  String get label => switch (this) {
    TaskPriority.low => 'Low',
    TaskPriority.normal => 'Normal',
    TaskPriority.urgent => 'Urgent',
  };
}

enum TaskRoleView {
  requester,
  provider;

  String get label => switch (this) {
    TaskRoleView.requester => 'Requester',
    TaskRoleView.provider => 'Provider',
  };
}

enum NotificationKind {
  task,
  connection,
  providerResponse,
  reminder,
  safety,
  system,
  message;

  String get label => switch (this) {
    NotificationKind.task => 'Task',
    NotificationKind.connection => 'Connection',
    NotificationKind.providerResponse => 'Provider reply',
    NotificationKind.reminder => 'Reminder',
    NotificationKind.safety => 'Safety',
    NotificationKind.system => 'System',
    NotificationKind.message => 'Message',
  };
}

enum NotificationPriority { low, normal, high }

enum SearchScope {
  all,
  listings,
  people,
  tasks,
  categories;

  String get label => switch (this) {
    SearchScope.all => 'All',
    SearchScope.listings => 'Listings',
    SearchScope.people => 'People',
    SearchScope.tasks => 'Tasks',
    SearchScope.categories => 'Categories',
  };
}

enum ProfileVisibility {
  everyone,
  connections,
  private;

  String get label => switch (this) {
    ProfileVisibility.everyone => 'Everyone',
    ProfileVisibility.connections => 'Connections only',
    ProfileVisibility.private => 'Only me',
  };
}

class ExploreCategory {
  const ExploreCategory({
    required this.id,
    required this.label,
    required this.icon,
    required this.activeCount,
  });

  final String id;
  final String label;
  final IconData icon;
  final int activeCount;
}

class ExploreItem {
  const ExploreItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.type,
    required this.category,
    required this.locality,
    required this.distanceKm,
    required this.priceLabel,
    required this.postedAt,
    required this.providerId,
    required this.providerName,
    required this.trustNote,
    required this.socialProof,
    required this.tags,
    required this.urgent,
    required this.verified,
    required this.saved,
    required this.rating,
    required this.reviewCount,
    required this.responseTimeMinutes,
    required this.mutualConnections,
    this.avatarUrl = '',
  });

  final String id;
  final String title;
  final String summary;
  final ExploreItemType type;
  final String category;
  final String locality;
  final double distanceKm;
  final String priceLabel;
  final DateTime postedAt;
  final String providerId;
  final String providerName;
  final String trustNote;
  final String socialProof;
  final List<String> tags;
  final bool urgent;
  final bool verified;
  final bool saved;
  final double rating;
  final int reviewCount;
  final int responseTimeMinutes;
  final int mutualConnections;
  final String avatarUrl;

  ExploreItem copyWith({bool? saved}) {
    return ExploreItem(
      id: id,
      title: title,
      summary: summary,
      type: type,
      category: category,
      locality: locality,
      distanceKm: distanceKm,
      priceLabel: priceLabel,
      postedAt: postedAt,
      providerId: providerId,
      providerName: providerName,
      trustNote: trustNote,
      socialProof: socialProof,
      tags: tags,
      urgent: urgent,
      verified: verified,
      saved: saved ?? this.saved,
      rating: rating,
      reviewCount: reviewCount,
      responseTimeMinutes: responseTimeMinutes,
      mutualConnections: mutualConnections,
      avatarUrl: avatarUrl,
    );
  }
}

class PersonSummary {
  const PersonSummary({
    required this.id,
    required this.name,
    required this.headline,
    required this.bio,
    required this.locality,
    required this.distanceKm,
    required this.responseTimeMinutes,
    required this.rating,
    required this.reviewCount,
    required this.completionPercent,
    required this.trustScore,
    required this.jobsCompleted,
    required this.serviceCategories,
    required this.roles,
    required this.verificationLevel,
    required this.connectionState,
    required this.saved,
    required this.isOnline,
    required this.mutualConnections,
    this.avatarUrl = '',
  });

  final String id;
  final String name;
  final String headline;
  final String bio;
  final String locality;
  final double distanceKm;
  final int responseTimeMinutes;
  final double rating;
  final int reviewCount;
  final int completionPercent;
  final int trustScore;
  final int jobsCompleted;
  final List<String> serviceCategories;
  final List<AppUserMode> roles;
  final VerificationLevel verificationLevel;
  final PeopleConnectionState connectionState;
  final bool saved;
  final bool isOnline;
  final int mutualConnections;
  final String avatarUrl;

  PersonSummary copyWith({
    PeopleConnectionState? connectionState,
    bool? saved,
  }) {
    return PersonSummary(
      id: id,
      name: name,
      headline: headline,
      bio: bio,
      locality: locality,
      distanceKm: distanceKm,
      responseTimeMinutes: responseTimeMinutes,
      rating: rating,
      reviewCount: reviewCount,
      completionPercent: completionPercent,
      trustScore: trustScore,
      jobsCompleted: jobsCompleted,
      serviceCategories: serviceCategories,
      roles: roles,
      verificationLevel: verificationLevel,
      connectionState: connectionState ?? this.connectionState,
      saved: saved ?? this.saved,
      isOnline: isOnline,
      mutualConnections: mutualConnections,
      avatarUrl: avatarUrl,
    );
  }
}

class ConnectionRequest {
  const ConnectionRequest({
    required this.id,
    required this.personId,
    required this.direction,
    required this.message,
    required this.createdAt,
  });

  final String id;
  final String personId;
  final ConnectionRequestDirection direction;
  final String message;
  final DateTime createdAt;
}

class TaskOffer {
  const TaskOffer({
    required this.id,
    required this.providerId,
    required this.providerName,
    required this.amountLabel,
    required this.etaLabel,
    required this.trustNote,
  });

  final String id;
  final String providerId;
  final String providerName;
  final String amountLabel;
  final String etaLabel;
  final String trustNote;
}

class TaskTimelineEntry {
  const TaskTimelineEntry({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.time,
    required this.isComplete,
    required this.isCurrent,
    required this.icon,
  });

  final String id;
  final String title;
  final String subtitle;
  final DateTime time;
  final bool isComplete;
  final bool isCurrent;
  final IconData icon;
}

class TaskItem {
  const TaskItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.category,
    required this.locality,
    required this.distanceKm,
    required this.budgetLabel,
    required this.status,
    required this.priority,
    required this.role,
    required this.customerName,
    required this.providerName,
    required this.linkedThreadId,
    required this.attachmentCount,
    required this.offerCount,
    required this.unreadChatCount,
    required this.timeline,
    required this.offers,
    required this.trustNote,
    required this.updatedAt,
    this.scheduledFor,
  });

  final String id;
  final String title;
  final String summary;
  final String category;
  final String locality;
  final double distanceKm;
  final String budgetLabel;
  final TaskStatus status;
  final TaskPriority priority;
  final TaskRoleView role;
  final String customerName;
  final String providerName;
  final String linkedThreadId;
  final int attachmentCount;
  final int offerCount;
  final int unreadChatCount;
  final List<TaskTimelineEntry> timeline;
  final List<TaskOffer> offers;
  final String trustNote;
  final DateTime updatedAt;
  final DateTime? scheduledFor;

  TaskItem copyWith({
    TaskStatus? status,
    int? unreadChatCount,
    List<TaskTimelineEntry>? timeline,
    DateTime? updatedAt,
  }) {
    return TaskItem(
      id: id,
      title: title,
      summary: summary,
      category: category,
      locality: locality,
      distanceKm: distanceKm,
      budgetLabel: budgetLabel,
      status: status ?? this.status,
      priority: priority,
      role: role,
      customerName: customerName,
      providerName: providerName,
      linkedThreadId: linkedThreadId,
      attachmentCount: attachmentCount,
      offerCount: offerCount,
      unreadChatCount: unreadChatCount ?? this.unreadChatCount,
      timeline: timeline ?? this.timeline,
      offers: offers,
      trustNote: trustNote,
      updatedAt: updatedAt ?? this.updatedAt,
      scheduledFor: scheduledFor,
    );
  }
}

class PortfolioEntry {
  const PortfolioEntry({
    required this.id,
    required this.title,
    required this.caption,
  });

  final String id;
  final String title;
  final String caption;
}

class ReviewSnippet {
  const ReviewSnippet({
    required this.id,
    required this.author,
    required this.comment,
    required this.rating,
  });

  final String id;
  final String author;
  final String comment;
  final double rating;
}

class ProfileSummary {
  const ProfileSummary({
    required this.id,
    required this.name,
    required this.headline,
    required this.bio,
    required this.locality,
    required this.languageCode,
    required this.availabilityLabel,
    required this.roles,
    required this.verificationLevel,
    required this.completionPercent,
    required this.responseRate,
    required this.responseTimeMinutes,
    required this.rating,
    required this.reviewCount,
    required this.serviceCategories,
    required this.portfolio,
    required this.reviews,
    required this.savedListingsCount,
    required this.savedPeopleCount,
    required this.activeTasksCount,
    required this.completedTasksCount,
    required this.connectionsCount,
    this.avatarUrl = '',
  });

  final String id;
  final String name;
  final String headline;
  final String bio;
  final String locality;
  final String languageCode;
  final String availabilityLabel;
  final List<AppUserMode> roles;
  final VerificationLevel verificationLevel;
  final int completionPercent;
  final int responseRate;
  final int responseTimeMinutes;
  final double rating;
  final int reviewCount;
  final List<String> serviceCategories;
  final List<PortfolioEntry> portfolio;
  final List<ReviewSnippet> reviews;
  final int savedListingsCount;
  final int savedPeopleCount;
  final int activeTasksCount;
  final int completedTasksCount;
  final int connectionsCount;
  final String avatarUrl;

  ProfileSummary copyWith({
    String? name,
    String? headline,
    String? bio,
    String? locality,
    String? languageCode,
    String? availabilityLabel,
    List<AppUserMode>? roles,
    VerificationLevel? verificationLevel,
    int? completionPercent,
    int? responseRate,
    int? responseTimeMinutes,
    List<String>? serviceCategories,
    int? savedListingsCount,
    int? savedPeopleCount,
    int? activeTasksCount,
    int? completedTasksCount,
    int? connectionsCount,
  }) {
    return ProfileSummary(
      id: id,
      name: name ?? this.name,
      headline: headline ?? this.headline,
      bio: bio ?? this.bio,
      locality: locality ?? this.locality,
      languageCode: languageCode ?? this.languageCode,
      availabilityLabel: availabilityLabel ?? this.availabilityLabel,
      roles: roles ?? this.roles,
      verificationLevel: verificationLevel ?? this.verificationLevel,
      completionPercent: completionPercent ?? this.completionPercent,
      responseRate: responseRate ?? this.responseRate,
      responseTimeMinutes: responseTimeMinutes ?? this.responseTimeMinutes,
      rating: rating,
      reviewCount: reviewCount,
      serviceCategories: serviceCategories ?? this.serviceCategories,
      portfolio: portfolio,
      reviews: reviews,
      savedListingsCount: savedListingsCount ?? this.savedListingsCount,
      savedPeopleCount: savedPeopleCount ?? this.savedPeopleCount,
      activeTasksCount: activeTasksCount ?? this.activeTasksCount,
      completedTasksCount: completedTasksCount ?? this.completedTasksCount,
      connectionsCount: connectionsCount ?? this.connectionsCount,
      avatarUrl: avatarUrl,
    );
  }
}

class NotificationPreferences {
  const NotificationPreferences({
    required this.taskUpdates,
    required this.connectionRequests,
    required this.messages,
    required this.reminders,
    required this.trustAlerts,
    required this.promotions,
  });

  final bool taskUpdates;
  final bool connectionRequests;
  final bool messages;
  final bool reminders;
  final bool trustAlerts;
  final bool promotions;

  NotificationPreferences copyWith({
    bool? taskUpdates,
    bool? connectionRequests,
    bool? messages,
    bool? reminders,
    bool? trustAlerts,
    bool? promotions,
  }) {
    return NotificationPreferences(
      taskUpdates: taskUpdates ?? this.taskUpdates,
      connectionRequests: connectionRequests ?? this.connectionRequests,
      messages: messages ?? this.messages,
      reminders: reminders ?? this.reminders,
      trustAlerts: trustAlerts ?? this.trustAlerts,
      promotions: promotions ?? this.promotions,
    );
  }
}

class PrivacySettings {
  const PrivacySettings({
    required this.profileVisibility,
    required this.showPreciseLocation,
    required this.showMutualConnections,
    required this.allowDirectMessages,
    required this.showOnlineStatus,
  });

  final ProfileVisibility profileVisibility;
  final bool showPreciseLocation;
  final bool showMutualConnections;
  final bool allowDirectMessages;
  final bool showOnlineStatus;

  PrivacySettings copyWith({
    ProfileVisibility? profileVisibility,
    bool? showPreciseLocation,
    bool? showMutualConnections,
    bool? allowDirectMessages,
    bool? showOnlineStatus,
  }) {
    return PrivacySettings(
      profileVisibility: profileVisibility ?? this.profileVisibility,
      showPreciseLocation: showPreciseLocation ?? this.showPreciseLocation,
      showMutualConnections:
          showMutualConnections ?? this.showMutualConnections,
      allowDirectMessages: allowDirectMessages ?? this.allowDirectMessages,
      showOnlineStatus: showOnlineStatus ?? this.showOnlineStatus,
    );
  }
}

class AppSettingsModel {
  const AppSettingsModel({
    required this.locationEnabled,
    required this.languageCode,
    required this.themeReady,
    required this.allowAnalytics,
    required this.blockedUserIds,
    required this.notificationPreferences,
    required this.privacySettings,
  });

  final bool locationEnabled;
  final String languageCode;
  final bool themeReady;
  final bool allowAnalytics;
  final List<String> blockedUserIds;
  final NotificationPreferences notificationPreferences;
  final PrivacySettings privacySettings;

  AppSettingsModel copyWith({
    bool? locationEnabled,
    String? languageCode,
    bool? themeReady,
    bool? allowAnalytics,
    List<String>? blockedUserIds,
    NotificationPreferences? notificationPreferences,
    PrivacySettings? privacySettings,
  }) {
    return AppSettingsModel(
      locationEnabled: locationEnabled ?? this.locationEnabled,
      languageCode: languageCode ?? this.languageCode,
      themeReady: themeReady ?? this.themeReady,
      allowAnalytics: allowAnalytics ?? this.allowAnalytics,
      blockedUserIds: blockedUserIds ?? this.blockedUserIds,
      notificationPreferences:
          notificationPreferences ?? this.notificationPreferences,
      privacySettings: privacySettings ?? this.privacySettings,
    );
  }
}

class ChatThread {
  const ChatThread({
    required this.id,
    required this.counterpartId,
    required this.counterpartName,
    required this.subtitle,
    required this.linkedTaskId,
    required this.lastMessagePreview,
    required this.lastMessageAt,
    required this.unreadCount,
    required this.pinned,
    required this.verified,
    required this.online,
    required this.safetyLabel,
    this.avatarUrl = '',
  });

  final String id;
  final String counterpartId;
  final String counterpartName;
  final String subtitle;
  final String? linkedTaskId;
  final String lastMessagePreview;
  final DateTime lastMessageAt;
  final int unreadCount;
  final bool pinned;
  final bool verified;
  final bool online;
  final String safetyLabel;
  final String avatarUrl;

  ChatThread copyWith({
    String? lastMessagePreview,
    DateTime? lastMessageAt,
    int? unreadCount,
    bool? pinned,
  }) {
    return ChatThread(
      id: id,
      counterpartId: counterpartId,
      counterpartName: counterpartName,
      subtitle: subtitle,
      linkedTaskId: linkedTaskId,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      pinned: pinned ?? this.pinned,
      verified: verified,
      online: online,
      safetyLabel: safetyLabel,
      avatarUrl: avatarUrl,
    );
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.threadId,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.sentAt,
    required this.isMine,
    required this.isSystem,
  });

  final String id;
  final String threadId;
  final String senderId;
  final String senderName;
  final String text;
  final DateTime sentAt;
  final bool isMine;
  final bool isSystem;
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.kind,
    required this.priority,
    required this.createdAt,
    required this.read,
    required this.route,
    required this.actionLabel,
    required this.entityId,
  });

  final String id;
  final String title;
  final String message;
  final NotificationKind kind;
  final NotificationPriority priority;
  final DateTime createdAt;
  final bool read;
  final String route;
  final String actionLabel;
  final String entityId;

  AppNotification copyWith({bool? read}) {
    return AppNotification(
      id: id,
      title: title,
      message: message,
      kind: kind,
      priority: priority,
      createdAt: createdAt,
      read: read ?? this.read,
      route: route,
      actionLabel: actionLabel,
      entityId: entityId,
    );
  }
}

class ExploreDashboard {
  const ExploreDashboard({
    required this.locationTitle,
    required this.categories,
    required this.trendingRequests,
    required this.recommendedProviders,
    required this.featuredOpportunities,
    required this.savedCount,
  });

  final String locationTitle;
  final List<ExploreCategory> categories;
  final List<ExploreItem> trendingRequests;
  final List<PersonSummary> recommendedProviders;
  final List<ExploreItem> featuredOpportunities;
  final int savedCount;
}

class PeopleHub {
  const PeopleHub({
    required this.acceptedConnections,
    required this.suggestedPeople,
    required this.incomingRequests,
    required this.outgoingRequests,
  });

  final List<PersonSummary> acceptedConnections;
  final List<PersonSummary> suggestedPeople;
  final List<ConnectionRequest> incomingRequests;
  final List<ConnectionRequest> outgoingRequests;
}

class TasksBoard {
  const TasksBoard({required this.items});

  final List<TaskItem> items;
}

class ProfileHub {
  const ProfileHub({
    required this.profile,
    required this.savedListings,
    required this.savedPeople,
    required this.recentSearches,
  });

  final ProfileSummary profile;
  final List<ExploreItem> savedListings;
  final List<PersonSummary> savedPeople;
  final List<String> recentSearches;
}

class NotificationsCenter {
  const NotificationsCenter({required this.items});

  final List<AppNotification> items;

  int get unreadCount => items.where((item) => !item.read).length;
}

class SearchResultItem {
  const SearchResultItem({
    required this.id,
    required this.scope,
    required this.title,
    required this.subtitle,
    required this.meta,
    required this.route,
    required this.trusted,
    required this.icon,
  });

  final String id;
  final SearchScope scope;
  final String title;
  final String subtitle;
  final String meta;
  final String route;
  final bool trusted;
  final IconData icon;
}

class ServiqMockState {
  const ServiqMockState({
    required this.locationTitle,
    required this.categories,
    required this.listings,
    required this.people,
    required this.connectionRequests,
    required this.tasks,
    required this.profile,
    required this.settings,
    required this.threads,
    required this.messagesByThreadId,
    required this.notifications,
    required this.recentSearches,
  });

  final String locationTitle;
  final List<ExploreCategory> categories;
  final List<ExploreItem> listings;
  final List<PersonSummary> people;
  final List<ConnectionRequest> connectionRequests;
  final List<TaskItem> tasks;
  final ProfileSummary profile;
  final AppSettingsModel settings;
  final List<ChatThread> threads;
  final Map<String, List<ChatMessage>> messagesByThreadId;
  final List<AppNotification> notifications;
  final List<String> recentSearches;

  ServiqMockState copyWith({
    String? locationTitle,
    List<ExploreCategory>? categories,
    List<ExploreItem>? listings,
    List<PersonSummary>? people,
    List<ConnectionRequest>? connectionRequests,
    List<TaskItem>? tasks,
    ProfileSummary? profile,
    AppSettingsModel? settings,
    List<ChatThread>? threads,
    Map<String, List<ChatMessage>>? messagesByThreadId,
    List<AppNotification>? notifications,
    List<String>? recentSearches,
  }) {
    return ServiqMockState(
      locationTitle: locationTitle ?? this.locationTitle,
      categories: categories ?? this.categories,
      listings: listings ?? this.listings,
      people: people ?? this.people,
      connectionRequests: connectionRequests ?? this.connectionRequests,
      tasks: tasks ?? this.tasks,
      profile: profile ?? this.profile,
      settings: settings ?? this.settings,
      threads: threads ?? this.threads,
      messagesByThreadId: messagesByThreadId ?? this.messagesByThreadId,
      notifications: notifications ?? this.notifications,
      recentSearches: recentSearches ?? this.recentSearches,
    );
  }
}
