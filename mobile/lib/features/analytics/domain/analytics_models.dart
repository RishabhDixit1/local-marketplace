class AnalyticsEarningsMonth {
  const AnalyticsEarningsMonth({
    required this.month,
    this.earnedPaise = 0,
    this.revenuePaise = 0,
    this.orders = 0,
  });

  factory AnalyticsEarningsMonth.fromJson(Map<String, dynamic> json) {
    return AnalyticsEarningsMonth(
      month: _readString(json['month']),
      earnedPaise: _toInt(json['earned']),
      revenuePaise: _toInt(json['revenue']),
      orders: _toInt(json['orders']),
    );
  }

  final String month;
  final int earnedPaise;
  final int revenuePaise;
  final int orders;
}

class AnalyticsSummary {
  const AnalyticsSummary({
    this.totalEarnedPaise = 0,
    this.totalRevenuePaise = 0,
    this.totalOrders = 0,
    this.completedOrders = 0,
    this.uniqueCustomers = 0,
    this.avgRating,
  });

  factory AnalyticsSummary.fromJson(Map<String, dynamic> json) {
    return AnalyticsSummary(
      totalEarnedPaise: _toInt(json['totalEarnedPaise']),
      totalRevenuePaise: _toInt(json['totalRevenuePaise']),
      totalOrders: _toInt(json['totalOrders']),
      completedOrders: _toInt(json['completedOrders']),
      uniqueCustomers: _toInt(json['uniqueCustomers']),
      avgRating: (json['avgRating'] as num?)?.toDouble(),
    );
  }

  final int totalEarnedPaise;
  final int totalRevenuePaise;
  final int totalOrders;
  final int completedOrders;
  final int uniqueCustomers;
  final double? avgRating;
}

class AnalyticsTopCustomer {
  const AnalyticsTopCustomer({
    required this.id,
    required this.name,
    this.orders = 0,
    this.spentPaise = 0,
  });

  factory AnalyticsTopCustomer.fromJson(Map<String, dynamic> json) {
    return AnalyticsTopCustomer(
      id: _readString(json['id']),
      name: _readString(json['name'], fallback: 'Unknown'),
      orders: _toInt(json['orders']),
      spentPaise: _toInt(json['spentPaise']),
    );
  }

  final String id;
  final String name;
  final int orders;
  final int spentPaise;
}

class AnalyticsData {
  const AnalyticsData({
    required this.earningsChart,
    required this.statusBreakdown,
    this.conversionRate = 0,
    required this.summary,
    required this.topCustomers,
  });

  factory AnalyticsData.fromJson(Map<String, dynamic> json) {
    final analytics = json['analytics'] as Map<String, dynamic>? ?? {};

    final earningsList = (analytics['earningsChartData'] as List?) ?? [];
    final statusMap = (analytics['statusBreakdown'] as Map<String, dynamic>?) ?? {};
    final customersList = (analytics['topCustomers'] as List?) ?? [];

    return AnalyticsData(
      earningsChart: earningsList
          .whereType<Map<String, dynamic>>()
          .map(AnalyticsEarningsMonth.fromJson)
          .toList(),
      statusBreakdown: statusMap.map((k, v) => MapEntry(_readString(k), _toInt(v))),
      conversionRate: (_toNum(analytics['conversionRate']) * 100).round(),
      summary: AnalyticsSummary.fromJson(
        (analytics['summary'] as Map<String, dynamic>?) ?? {},
      ),
      topCustomers: customersList
          .whereType<Map<String, dynamic>>()
          .map(AnalyticsTopCustomer.fromJson)
          .toList(),
    );
  }

  final List<AnalyticsEarningsMonth> earningsChart;
  final Map<String, int> statusBreakdown;
  final int conversionRate;
  final AnalyticsSummary summary;
  final List<AnalyticsTopCustomer> topCustomers;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

num _toNum(Object? value, {num fallback = 0}) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value) ?? fallback;
  return fallback;
}
