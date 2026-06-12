import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../data/booking_repository.dart';
import '../domain/booking_model.dart';

class BookingsPage extends ConsumerStatefulWidget {
  const BookingsPage({super.key});

  @override
  ConsumerState<BookingsPage> createState() => _BookingsPageState();
}

class _BookingsPageState extends ConsumerState<BookingsPage> {
  @override
  Widget build(BuildContext context) {
    final asyncBookings = ref.watch(bookingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Bookings')),
      body: SafeArea(
        child: asyncBookings.isLoading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : asyncBookings.hasError
            ? _buildError(asyncBookings.error)
            : _buildContent(asyncBookings.value ?? []),
      ),
    );
  }

  Widget _buildError(Object? error) {
    final message = error is Exception ? error.toString() : 'Unable to load bookings.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: EmptyStateView(
          title: 'Failed to load',
          message: message,
          icon: Icons.error_outline_rounded,
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(bookingsProvider),
        ),
      ),
    );
  }

  Widget _buildContent(List<Booking> bookings) {
    final now = DateTime.now();
    final upcoming = bookings.where((b) {
      if (b.status != 'confirmed') return false;
      final dt = b.scheduledDateTime;
      return dt == null || dt.isAfter(now);
    }).toList();

    final past = bookings.where((b) {
      if (b.status != 'confirmed') return true;
      final dt = b.scheduledDateTime;
      return dt != null && !dt.isAfter(now);
    }).toList();

    if (bookings.isEmpty) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: const [
          SectionCard(
            child: EmptyStateView(
              icon: Icons.calendar_month_outlined,
              title: 'No bookings yet',
              message: 'When someone books your time, it will show up here.',
            ),
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(bookingsProvider);
        await ref.read(bookingsProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          if (upcoming.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text('Upcoming',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: AppColors.inkSubtle, fontWeight: FontWeight.bold)),
            ),
            ...upcoming.map((b) => _BookingCard(booking: b)),
            const SizedBox(height: 16),
          ],
          if (past.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text('Past',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: AppColors.inkSubtle, fontWeight: FontWeight.bold)),
            ),
            ...past.map((b) => _BookingCard(booking: b)),
          ],
        ],
      ),
    );
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(booking.scheduledDate);
    final dayName = date != null
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.weekday % 7]
        : '';
    final monthDay = date != null
        ? '${date.day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.month - 1]}'
        : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => context.push(AppRoutes.orderDetail(booking.orderId)),
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                booking.displayTitle,
                                style: Theme.of(context)
                                    .textTheme
                                    .titleSmall
                                    ?.copyWith(fontWeight: FontWeight.bold),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: booking.statusBgColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                booking.status,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: booking.statusColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'with ${booking.consumerName}',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.inkSubtle),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(dayName,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.bold)),
                      Text(monthDay,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.inkSubtle)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.schedule, size: 14, color: AppColors.inkSubtle),
                  const SizedBox(width: 4),
                  Text(
                    '${booking.startTime.length >= 5 ? booking.startTime.substring(0, 5) : booking.startTime} - ${booking.endTime.length >= 5 ? booking.endTime.substring(0, 5) : booking.endTime}',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: AppColors.inkSubtle),
                  ),
                ],
              ),
              if (booking.notes != null && booking.notes!.trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  booking.notes!,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: AppColors.inkFaint, fontStyle: FontStyle.italic),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
