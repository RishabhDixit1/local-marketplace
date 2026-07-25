import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/design_system/serviq_chrome.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../data/quote_repository.dart';
import '../domain/quote_models.dart';

final _currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
String _inr(double n) => _currencyFormat.format(n);

final _comparisonProvider =
    FutureProvider.family<ComparisonQuoteResult, String>((ref, helpRequestId) {
  return ref.watch(quoteRepositoryProvider).fetchQuotesForRequest(helpRequestId);
});

class QuoteComparisonPage extends ConsumerStatefulWidget {
  const QuoteComparisonPage({super.key, required this.helpRequestId});

  final String helpRequestId;

  @override
  ConsumerState<QuoteComparisonPage> createState() => _QuoteComparisonPageState();
}

class _QuoteComparisonPageState extends ConsumerState<QuoteComparisonPage> {
  String? _acceptingId;
  String? _acceptedId;

  Future<void> _acceptQuote(ComparisonQuote quote) async {
    setState(() => _acceptingId = quote.id);
    try {
      await ref.read(quoteRepositoryProvider).acceptQuote(quote.id);
      if (mounted) {
        setState(() => _acceptedId = quote.id);
        ServiqToast.show(context, message: 'Quote accepted!', tone: ServiqToastTone.success);
      }
    } on ApiException catch (e) {
      if (mounted) ServiqToast.show(context, message: e.message, tone: ServiqToastTone.danger);
    } catch (e) {
      if (mounted) ServiqToast.show(context, message: 'Failed to accept quote.', tone: ServiqToastTone.danger);
    } finally {
      if (mounted) setState(() => _acceptingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final resultAsync = ref.watch(_comparisonProvider(widget.helpRequestId));

    return Scaffold(
      appBar: AppBar(title: const Text('Compare Quotes')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(_comparisonProvider(widget.helpRequestId));
            await ref.read(_comparisonProvider(widget.helpRequestId).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ServiqAsyncBody<ComparisonQuoteResult>(
                value: resultAsync,
                errorTitle: 'Unable to load quotes',
                onRetry: () {
                  ref.invalidate(_comparisonProvider(widget.helpRequestId));
                },
                data: (result) => _buildContent(result),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(ComparisonQuoteResult result) {
    if (result.quotes.isEmpty) {
      return const Padding(
        padding: EdgeInsets.only(top: 48),
        child: EmptyStateView(
          title: 'No quotes yet',
          message: 'When providers submit quotes for this request, they\'ll appear here.',
        ),
      );
    }

    final sorted = List<ComparisonQuote>.from(result.quotes)
      ..sort((a, b) => a.total.compareTo(b.total));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (result.helpRequestTitle.isNotEmpty) ...[
          Text(
            result.helpRequestTitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (_acceptedId != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.successSoft,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Quote accepted! Redirecting to order...',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.success,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        Text(
          '${sorted.length} quote${sorted.length == 1 ? '' : 's'} received',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
          ),
        ),
        const SizedBox(height: 12),
        ...sorted.map((quote) => _quoteCard(quote)),
      ],
    );
  }

  Widget _quoteCard(ComparisonQuote quote) {
    final canAccept = quote.status == 'sent' && _acceptedId == null;
    final isAccepted = _acceptedId == quote.id;
    final isCurrentAccepting = _acceptingId == quote.id;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  backgroundImage: quote.providerAvatar != null ? NetworkImage(quote.providerAvatar!) : null,
                  child: quote.providerAvatar == null
                      ? Text(quote.providerName.isNotEmpty ? quote.providerName[0].toUpperCase() : '?',
                          style: Theme.of(context).textTheme.labelMedium)
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              quote.providerName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                            ),
                          ),
                          if (quote.isFromAcceptedProvider) ...[
                            const SizedBox(width: 6),
                            Icon(Icons.verified_rounded, size: 16, color: AppColors.accent),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      _statusChip(quote.status),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _inr(quote.total),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                    if (quote.taxAmount > 0)
                      Text(
                        'incl. ${_inr(quote.taxAmount)} tax',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 10,
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                      ),
                  ],
                ),
              ],
            ),
            if (quote.summary != null && quote.summary!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                quote.summary!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.5),
              ),
            ],
            if (quote.lineItems.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Items', style: Theme.of(context).textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
              )),
              const SizedBox(height: 4),
              ...quote.lineItems.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${item.label}${item.quantity > 1 ? ' (x${item.quantity})' : ''}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    Text(
                      _inr(item.amount),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              )),
            ],
            if (quote.notes != null && quote.notes!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Text(
                  quote.notes!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontStyle: FontStyle.italic,
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ),
            ],
            if (quote.sentAt != null || quote.expiresAt != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  if (quote.sentAt != null) ...[
                    Icon(Icons.calendar_today_outlined, size: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4)),
                    const SizedBox(width: 4),
                    Text(
                      'Sent ${DateFormat('d MMM').format(quote.sentAt!)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                  if (quote.sentAt != null && quote.expiresAt != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      child: Text('·', style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.3))),
                    ),
                  if (quote.expiresAt != null) ...[
                    Icon(Icons.schedule_outlined, size: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4)),
                    const SizedBox(width: 4),
                    Text(
                      'Expires ${DateFormat('d MMM').format(quote.expiresAt!)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  ],
                ],
              ),
            ],
            const SizedBox(height: 12),
            if (isAccepted)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.successSoft,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle_rounded, size: 16, color: AppColors.success),
                    const SizedBox(width: 6),
                    Text(
                      'Accepted',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              )
            else if (canAccept)
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: isCurrentAccepting ? null : () => _acceptQuote(quote),
                  child: isCurrentAccepting
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Theme.of(context).colorScheme.onPrimary),
                        )
                      : const Text('Accept this quote'),
                ),
              )
            else
              Text(
                _acceptedId != null ? 'Another quote was accepted' : 'This quote is no longer available',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    Color bg;
    Color fg;
    switch (status) {
      case 'sent':
        bg = AppColors.accentSoft;
        fg = AppColors.accent;
      case 'accepted':
        bg = AppColors.successSoft;
        fg = AppColors.success;
      case 'expired':
        bg = AppColors.surfaceAlt;
        fg = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);
      case 'cancelled':
        bg = AppColors.dangerSoft;
        fg = AppColors.danger;
      default:
        bg = AppColors.surfaceAlt;
        fg = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}
