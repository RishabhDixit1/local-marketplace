class NotificationSettings {
  const NotificationSettings({
    this.orderNotifications = true,
    this.promoNotifications = true,
    this.messageNotifications = true,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) {
    return NotificationSettings(
      orderNotifications: json['order_notifications'] != false,
      promoNotifications: json['promo_notifications'] != false,
      messageNotifications: json['message_notifications'] != false,
    );
  }

  final bool orderNotifications;
  final bool promoNotifications;
  final bool messageNotifications;

  Map<String, dynamic> toJson() => {
    'order_notifications': orderNotifications,
    'promo_notifications': promoNotifications,
    'message_notifications': messageNotifications,
  };

  NotificationSettings copyWith({
    bool? orderNotifications,
    bool? promoNotifications,
    bool? messageNotifications,
  }) {
    return NotificationSettings(
      orderNotifications: orderNotifications ?? this.orderNotifications,
      promoNotifications: promoNotifications ?? this.promoNotifications,
      messageNotifications: messageNotifications ?? this.messageNotifications,
    );
  }
}
