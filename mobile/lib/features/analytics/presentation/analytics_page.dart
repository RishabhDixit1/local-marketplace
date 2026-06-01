import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../data/analytics_repository.dart';
import '../domain/analytics_models.dart';

final _currencyFormat = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
String _inr(int n) => _currencyFormat.format(n);

class AnalyticsPage extends ConsumerStatefulWidget {
  const AnalyticsPage({super.key});

  @override
  ConsumerState<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends ConsumerState<AnalyticsPage> {
  int _selectedYear = DateTime.now().year;

  void _refresh() {
    ref.invalidate(analyticsProvider(_selectedYear));
  }

  static const _chartColors = [
    AppColors.ink,
    AppColors.primary,
    AppColors.success,
    AppColors.warning,
    AppColors.danger,
    AppColors.accent,
  ];

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(analyticsProvider(_selectedYear));

    return Scaffold(
      appBar: AppBar(title: const Text('Analytics')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(analyticsProvider(_selectedYear));
            await ref.read(analyticsProvider(_selectedYear).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              Text('Your performance and earnings overview.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.inkSubtle)),
              const SizedBox(height: 16),
              ServiqAsyncBody<AnalyticsData>(
                value: asyncData,
                errorTitle: 'Unable to load analytics',
                onRetry: _refresh,
                data: (data) => _buildContent(data),
                loadingBuilder: () => const _AnalyticsLoadingState(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(AnalyticsData data) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildYearSelector(),
        const SizedBox(height: 16),
        _buildSummaryGrid(data.summary),
        const SizedBox(height: 16),
        _buildEarningsChart(data),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _buildStatusPieChart(data)),
            const SizedBox(width: 10),
            Expanded(child: _buildOrdersLineChart(data)),
          ],
        ),
        if (data.topCustomers.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildTopCustomers(data.topCustomers),
        ],
      ],
    );
  }

  Widget _buildYearSelector() {
    final now = DateTime.now().year;
    final years = [now - 2, now - 1, now, now + 1];

    return Row(
      children: [
        const Text('Year: ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        const SizedBox(width: 8),
        DropdownButton<int>(
          value: _selectedYear,
          items: years.map((y) => DropdownMenuItem(value: y, child: Text('$y'))).toList(),
          onChanged: (v) {
            if (v == null) return;
            setState(() => _selectedYear = v);
            _refresh();
          },
        ),
      ],
    );
  }

  Widget _buildSummaryGrid(AnalyticsSummary summary) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final gap = 10.0;
        final half = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(width: half, child: _metricCard(Icons.account_balance_wallet_outlined, 'Total Earned', _inr(summary.totalEarnedPaise ~/ 100), AppColors.success)),
            SizedBox(width: half, child: _metricCard(Icons.trending_up, 'Revenue', _inr(summary.totalRevenuePaise ~/ 100), AppColors.primary)),
            SizedBox(width: half, child: _metricCard(Icons.shopping_cart_outlined, 'Orders', '${summary.totalOrders}', AppColors.ink)),
            SizedBox(width: half, child: _metricCard(Icons.people_outline, 'Customers', '${summary.uniqueCustomers}', AppColors.accent)),
            SizedBox(width: half, child: _metricCard(Icons.star_outline, 'Rating', summary.avgRating != null ? '${summary.avgRating!.toStringAsFixed(1)}/5' : '—', AppColors.warning)),
          ],
        );
      },
    );
  }

  Widget _metricCard(IconData icon, String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.ink)),
        ],
      ),
    );
  }

  Widget _buildEarningsChart(AnalyticsData data) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('Earnings', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold))),
              if (data.conversionRate > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppColors.accentSoft, borderRadius: BorderRadius.circular(12)),
                  child: Text('${data.conversionRate}% conversion', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.accent)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _legendDot(AppColors.ink, 'Earned'),
              const SizedBox(width: 14),
              _legendDot(AppColors.primary, 'Revenue'),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 220,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                maxY: _maxPaise(data.earningsChart.map((e) => e.revenuePaise).toList()),
                barTouchData: BarTouchData(enabled: true, touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, groupIndex, rod, rodIndex) {
                    final month = data.earningsChart[groupIndex].month;
                    final label = rodIndex == 0 ? 'Earned' : 'Revenue';
                    return BarTooltipItem('$month\n$label: ${_inr(rod.toY.round() ~/ 100)}', const TextStyle(color: Colors.white, fontSize: 11));
                  },
                )),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 36, getTitlesWidget: (v, _) => Text('${(v ~/ 100).toInt()}', style: const TextStyle(fontSize: 9, color: AppColors.inkSubtle)))),
                  bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
                    final i = v.toInt();
                    if (i < 0 || i >= data.earningsChart.length) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(data.earningsChart[i].month.substring(0, 3), style: const TextStyle(fontSize: 9, color: AppColors.inkSubtle)),
                    );
                  })),
                ),
                gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: _maxPaise(data.earningsChart.map((e) => e.revenuePaise).toList()) / 4),
                borderData: FlBorderData(show: false),
                barGroups: List.generate(data.earningsChart.length, (i) {
                  final month = data.earningsChart[i];
                  return BarChartGroupData(x: i, barRods: [
                    BarChartRodData(toY: month.earnedPaise.toDouble(), color: AppColors.ink, width: 10, borderRadius: const BorderRadius.only(topLeft: Radius.circular(3), topRight: Radius.circular(3))),
                    BarChartRodData(toY: month.revenuePaise.toDouble(), color: AppColors.primary, width: 10, borderRadius: const BorderRadius.only(topLeft: Radius.circular(3), topRight: Radius.circular(3))),
                  ], barsSpace: 3);
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPieChart(AnalyticsData data) {
    final entries = data.statusBreakdown.entries.toList();
    if (entries.isEmpty) return const SizedBox.shrink();

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Orders by Status', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SizedBox(
            height: 130,
            child: PieChart(
              PieChartData(
                sectionsSpace: 2,
                centerSpaceRadius: 30,
                sections: List.generate(entries.length, (i) {
                  return PieChartSectionData(
                    value: entries[i].value.toDouble(),
                    color: _chartColors[i % _chartColors.length],
                    radius: 28,
                    title: '${entries[i].value}',
                    titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                  );
                }),
              ),
            ),
          ),
          const SizedBox(height: 6),
          ...entries.take(6).map((e) {
            final ci = entries.indexOf(e) % _chartColors.length;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: _chartColors[ci], shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Expanded(child: Text(e.key, style: const TextStyle(fontSize: 10, color: AppColors.inkSubtle))),
                  Text('${e.value}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildOrdersLineChart(AnalyticsData data) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Orders / Month', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          SizedBox(
            height: 130,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: _maxOrd(data.earningsChart.map((e) => e.orders).toList()),
                lineTouchData: LineTouchData(enabled: true, touchTooltipData: LineTouchTooltipData(getTooltipItems: (spots) {
                  return spots.map((s) {
                    final month = data.earningsChart[s.spotIndex].month;
                    return LineTooltipItem('$month: ${s.y.toInt()} orders', const TextStyle(color: Colors.white, fontSize: 10));
                  }).toList();
                })),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, getTitlesWidget: (v, _) {
                    final i = v.toInt();
                    if (i < 0 || i >= data.earningsChart.length) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(data.earningsChart[i].month.substring(0, 3), style: const TextStyle(fontSize: 8, color: AppColors.inkSubtle)),
                    );
                  })),
                ),
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: List.generate(data.earningsChart.length, (i) => FlSpot(i.toDouble(), data.earningsChart[i].orders.toDouble())),
                    color: AppColors.success,
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(show: true, color: AppColors.success.withValues(alpha: 0.1)),
                    isCurved: true,
                    curveSmoothness: 0.3,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopCustomers(List<AnalyticsTopCustomer> customers) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Top Customers', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ...List.generate(customers.length, (i) {
            final c = customers[i];
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: AppColors.surfaceAlt, borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(8)),
                    child: Text('${i + 1}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primary)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        const SizedBox(height: 1),
                        Text('${c.orders} orders', style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
                      ],
                    ),
                  ),
                  Text(_inr(c.spentPaise ~/ 100), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.ink)),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle)),
      ],
    );
  }

  double _maxPaise(List<int> values) {
    final max = values.reduce((a, b) => a > b ? a : b);
    return (max * 1.2).toDouble().clamp(1, double.infinity);
  }

  double _maxOrd(List<int> values) {
    final max = values.reduce((a, b) => a > b ? a : b);
    return (max * 1.5).toDouble().clamp(5, double.infinity);
  }
}

class _AnalyticsLoadingState extends StatelessWidget {
  const _AnalyticsLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(4, (_) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: SectionCard(
          child: SizedBox(
            height: 80,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary.withValues(alpha: 0.3))),
          ),
        ),
      )),
    );
  }
}
