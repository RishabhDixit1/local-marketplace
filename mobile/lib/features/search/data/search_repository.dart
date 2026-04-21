import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(ref);
});

final recentSearchesProvider = Provider<List<String>>((ref) {
  return ref.watch(serviqMockStoreProvider).recentSearches;
});

class SearchRepository {
  SearchRepository(this._ref);

  final Ref _ref;

  Future<List<SearchResultItem>> search({
    required String query,
    required SearchScope scope,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 160));
    final normalized = query.trim().toLowerCase();
    final state = _ref.read(serviqMockStoreProvider);

    final results = <SearchResultItem>[];

    if (scope == SearchScope.all || scope == SearchScope.categories) {
      for (final category in state.categories) {
        final haystack = '${category.label} ${category.activeCount}'
            .toLowerCase();
        if (normalized.isEmpty || haystack.contains(normalized)) {
          results.add(
            SearchResultItem(
              id: category.id,
              scope: SearchScope.categories,
              title: category.label,
              subtitle: '${category.activeCount} live nearby opportunities',
              meta: 'Category',
              route: AppRoutes.explore,
              trusted: false,
              icon: category.icon,
            ),
          );
        }
      }
    }

    if (scope == SearchScope.all || scope == SearchScope.listings) {
      for (final item in state.listings) {
        final haystack =
            '${item.title} ${item.summary} ${item.category} ${item.locality}'
                .toLowerCase();
        if (normalized.isEmpty || haystack.contains(normalized)) {
          results.add(
            SearchResultItem(
              id: item.id,
              scope: SearchScope.listings,
              title: item.title,
              subtitle: item.summary,
              meta: '${item.locality} • ${item.priceLabel}',
              route: AppRoutes.explore,
              trusted: item.verified,
              icon: Icons.explore_outlined,
            ),
          );
        }
      }
    }

    if (scope == SearchScope.all || scope == SearchScope.people) {
      for (final person in state.people) {
        final haystack =
            '${person.name} ${person.headline} ${person.locality} ${person.serviceCategories.join(' ')}'
                .toLowerCase();
        if (normalized.isEmpty || haystack.contains(normalized)) {
          results.add(
            SearchResultItem(
              id: person.id,
              scope: SearchScope.people,
              title: person.name,
              subtitle: person.headline,
              meta:
                  '${person.locality} • ${person.responseTimeMinutes} min reply',
              route: AppRoutes.people,
              trusted: person.verificationLevel != VerificationLevel.unverified,
              icon: Icons.people_alt_outlined,
            ),
          );
        }
      }
    }

    if (scope == SearchScope.all || scope == SearchScope.tasks) {
      for (final task in state.tasks) {
        final haystack =
            '${task.title} ${task.summary} ${task.category} ${task.locality}'
                .toLowerCase();
        if (normalized.isEmpty || haystack.contains(normalized)) {
          results.add(
            SearchResultItem(
              id: task.id,
              scope: SearchScope.tasks,
              title: task.title,
              subtitle: task.summary,
              meta: '${task.status.label} • ${task.locality}',
              route: AppRoutes.taskDetail(task.id),
              trusted: true,
              icon: Icons.assignment_outlined,
            ),
          );
        }
      }
    }

    return results;
  }

  Future<void> addRecentSearch(String query) async {
    _ref.read(serviqMockStoreProvider.notifier).addRecentSearch(query);
  }

  Future<void> clearRecentSearches() async {
    _ref.read(serviqMockStoreProvider.notifier).clearRecentSearches();
  }
}
