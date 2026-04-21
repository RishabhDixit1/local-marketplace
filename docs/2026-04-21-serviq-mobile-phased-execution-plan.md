# ServiQ Mobile Phased Execution Plan

## Phase 1
### Scope
- Foundations
- Design system
- App shell
- Navigation
- Shared components

### Screens / files
- `mobile/lib/core/theme/design_tokens.dart`
- `mobile/lib/core/theme/app_theme.dart`
- `mobile/lib/app/presentation/app_shell.dart`
- `mobile/lib/app/presentation/main_bottom_nav.dart`
- `mobile/lib/app/router/app_router.dart`
- `mobile/lib/shared/widgets/cards.dart`
- `mobile/lib/shared/widgets/chips.dart`
- `mobile/lib/shared/widgets/empty_state.dart`
- `mobile/lib/shared/widgets/error_state.dart`
- `mobile/lib/shared/widgets/loading_skeletons.dart`
- `mobile/lib/shared/widgets/section_header.dart`
- `mobile/lib/core/models/serviq_models.dart`
- `mobile/lib/core/mock/serviq_mock_store.dart`

### Dependencies
- Existing Riverpod app bootstrap
- Existing auth and Supabase session wiring
- Existing `go_router` shell pattern

### APIs / data contracts needed
- `GET /mobile/bootstrap`
  - theme flags, feature flags, app copy, legal/version payload
- `GET /me`
  - core identity, trust badges, location summary, unread counts
- `GET /navigation/badges`
  - unread chat count, actionable task count, unread notifications

### Analytics events
- `app_open_mobile`
- `bootstrap_success`
- `bootstrap_failure`
- `open_bottom_nav_tab`
- `tap_primary_fab_post_need`
- `open_search_global`
- `open_notifications_center`

### QA checklist
- Theme renders consistently on compact and tall phones
- Bottom nav persists selected tab and badge counts
- App shell survives auth redirect and app relaunch
- Empty, loading, and error components all render cleanly
- Text scaling at 1.2x and 1.4x does not break key layouts

### Risks
- Design tokens drift from web brand if not governed centrally
- Shell badge counts can become inconsistent if sourced independently
- Old screens may regress if token compatibility is broken

### Mock first vs real backend
- Mock first
  - shell badges
  - design system content
  - shared states
- Real backend required
  - auth bootstrap
  - unread counters
  - feature flags

## Phase 2
### Scope
- Explore
- Search

### Screens / files
- `mobile/lib/features/explore/presentation/explore_screen.dart`
- `mobile/lib/features/explore/presentation/explore_header.dart`
- `mobile/lib/features/explore/presentation/explore_filters_sheet.dart`
- `mobile/lib/features/explore/presentation/explore_cards.dart`
- `mobile/lib/features/search/presentation/global_search_screen.dart`
- `mobile/lib/features/search/presentation/search_results_sections.dart`
- `mobile/lib/features/explore/data/explore_repository.dart`
- `mobile/lib/features/search/data/search_repository.dart`

### Dependencies
- Phase 1 shell and shared widgets
- User location summary
- Ranking service or feed assembly service

### APIs / data contracts needed
- `GET /explore`
  - `location_title`
  - `categories[]`
  - `trending_requests[]`
  - `featured_opportunities[]`
  - `recommended_providers[]`
- `POST /saved/listings/:id`
- `DELETE /saved/listings/:id`
- `POST /saved/people/:id`
- `DELETE /saved/people/:id`
- `GET /search?q=&scope=&sort=`
  - unified result payload with type-specific result cards

### Analytics events
- `open_explore_tab`
- `tap_explore_filter`
- `apply_explore_filters`
- `toggle_explore_map_view`
- `save_listing`
- `save_provider_from_explore`
- `open_listing_from_explore`
- `use_global_search`
- `submit_search_query`
- `tap_recent_search`

### QA checklist
- Explore opens quickly with visible trust signals above the fold
- Search debounces correctly and feels instant for cached queries
- Filters update results and preserve current state on back navigation
- No-results state suggests productive next actions
- Saving items updates profile counts and recents correctly

### Risks
- Weak ranking logic can make local relevance feel fake
- Search can feel noisy if types are mixed without confidence scoring
- Empty low-supply cities need fallback UX, not blank feeds

### Mock first vs real backend
- Mock first
  - category grid
  - filter sheet behavior
  - search recents
- Real backend required
  - local feed ranking
  - saved state persistence
  - search relevance and autocomplete

## Phase 3
### Scope
- People
- Profile

### Screens / files
- `mobile/lib/features/people/presentation/people_screen.dart`
- `mobile/lib/features/people/presentation/people_cards.dart`
- `mobile/lib/features/people/presentation/connection_requests_section.dart`
- `mobile/lib/features/profile/presentation/profile_screen.dart`
- `mobile/lib/features/profile/presentation/edit_profile_screen.dart`
- `mobile/lib/features/profile/presentation/profile_widgets.dart`
- `mobile/lib/features/people/data/people_hub_repository.dart`
- `mobile/lib/features/profile/data/profile_hub_repository.dart`

### Dependencies
- Identity model and trust model
- Connection graph service
- Saved entities service

### APIs / data contracts needed
- `GET /people`
  - accepted connections, suggestions, incoming requests, outgoing requests
- `POST /connections`
- `PATCH /connections/:id`
- `POST /safety/block-user`
- `POST /safety/report-user`
- `GET /profile/me`
- `PATCH /profile/me`

### Analytics events
- `open_people_tab`
- `send_connection_request`
- `accept_connection_request`
- `save_person`
- `block_person`
- `report_person`
- `open_profile_tab`
- `tap_edit_profile`
- `update_profile_completion`
- `share_profile`

### QA checklist
- Connection request acceptance updates People and Profile state
- Saved providers appear inside Profile immediately
- Profile completion rises and falls logically with edits
- Privacy-safe copy avoids overexposing location or online state
- Trust signals remain visible without overpowering the layout

### Risks
- Trust score can feel arbitrary if not explainable
- Connection graph abuse can damage safety if rate limits are missing
- Profile completion can become gamified without real trust value

### Mock first vs real backend
- Mock first
  - connection flows
  - saved people
  - profile completion math
- Real backend required
  - graph storage
  - verification badges
  - public/private profile controls

## Phase 4
### Scope
- Tasks
- Chat
- Notifications

### Screens / files
- `mobile/lib/features/tasks/presentation/tasks_screen.dart`
- `mobile/lib/features/tasks/presentation/task_detail_screen.dart`
- `mobile/lib/features/tasks/presentation/task_cards.dart`
- `mobile/lib/features/tasks/presentation/task_status_timeline.dart`
- `mobile/lib/features/chat/presentation/chat_list_screen.dart`
- `mobile/lib/features/chat/presentation/chat_thread_screen.dart`
- `mobile/lib/features/chat/presentation/chat_widgets.dart`
- `mobile/lib/features/notifications/presentation/notifications_screen.dart`
- `mobile/lib/features/notifications/presentation/notification_tiles.dart`
- `mobile/lib/features/tasks/data/tasks_repository.dart`
- `mobile/lib/features/chat/data/chat_hub_repository.dart`
- `mobile/lib/features/notifications/data/notifications_center_repository.dart`

### Dependencies
- Task orchestration state machine
- Message delivery and unread count service
- Notification routing and preference gates

### APIs / data contracts needed
- `GET /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id/status`
- `GET /chat/threads`
- `GET /chat/threads/:id/messages`
- `POST /chat/threads/:id/messages`
- `POST /chat/threads/:id/read`
- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`

### Analytics events
- `open_tasks_tab`
- `open_task_detail`
- `advance_task_status`
- `open_chat_tab`
- `open_chat_thread`
- `send_message`
- `pin_chat_thread`
- `open_notifications_tab`
- `mark_notification_read`
- `mark_all_notifications_read`

### QA checklist
- Task status actions update timelines and notifications
- Thread unread counts clear on open
- Notifications deep-link into the correct task or chat
- Pinned threads stay pinned after refresh
- Completed tasks remain readable and audit-friendly

### Risks
- Task state can desync between requester and provider without strong backend rules
- Chat abuse and spam need moderation controls before scale
- Notifications become noisy if priority gates are weak

### Mock first vs real backend
- Mock first
  - timeline UI
  - pinning and local unread state
  - notification grouping
- Real backend required
  - realtime task sync
  - message persistence and delivery guarantees
  - notification fanout and preference enforcement

## Phase 5
### Scope
- Settings
- Trust / safety
- Polish

### Screens / files
- `mobile/lib/features/settings/presentation/settings_screen.dart`
- `mobile/lib/features/settings/presentation/privacy_settings_screen.dart`
- `mobile/lib/features/settings/presentation/notification_settings_screen.dart`
- `mobile/lib/features/settings/data/settings_repository.dart`
- remaining support surfaces for support, blocked users, help, reporting, and verification

### Dependencies
- Trust and safety moderation service
- Permissions manager
- Legal, support, and compliance flows

### APIs / data contracts needed
- `GET /settings`
- `PATCH /settings`
- `GET /blocked-users`
- `DELETE /blocked-users/:id`
- `POST /support/ticket`
- `POST /account/delete-request`
- `POST /verification/start`

### Analytics events
- `open_settings`
- `change_privacy_setting`
- `change_notification_setting`
- `toggle_location_permission_intent`
- `open_help_support`
- `start_verification`
- `request_account_delete`

### QA checklist
- Privacy toggles persist after app restart
- Notification preferences alter center behavior correctly
- Destructive flows always require a confirmation step
- Blocked users disappear from People, Explore, and Chat
- Help/support flows work on poor connectivity

### Risks
- Safety surfaces can feel ornamental if not enforced everywhere
- Delete-account and export flows are compliance-sensitive
- Permissions UX can feel deceptive if the app state lags system state

### Mock first vs real backend
- Mock first
  - settings UI
  - local toggle persistence
  - blocked list rendering
- Real backend required
  - trust enforcement
  - moderation review queues
  - legal/compliance deletion flows
