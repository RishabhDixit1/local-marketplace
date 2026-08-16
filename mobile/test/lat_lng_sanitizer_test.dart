import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

import 'package:serviq_mobile/core/utils/lat_lng_sanitizer.dart';

void main() {
  group('sanitizeLatLng', () {
    test('returns a LatLng for valid coordinates', () {
      final result = sanitizeLatLng(28.6139, 77.2090);
      expect(result, isA<LatLng>());
      expect(result!.latitude, 28.6139);
      expect(result.longitude, 77.2090);
    });

    test('accepts the extreme valid bounds', () {
      expect(sanitizeLatLng(90, 180), isA<LatLng>());
      expect(sanitizeLatLng(-90, -180), isA<LatLng>());
    });

    test('returns null when lat is null', () {
      expect(sanitizeLatLng(null, 77.2090), isNull);
    });

    test('returns null when lng is null', () {
      expect(sanitizeLatLng(28.6139, null), isNull);
    });

    test('returns null when both are null', () {
      expect(sanitizeLatLng(null, null), isNull);
    });

    test('returns null for NaN lat', () {
      expect(sanitizeLatLng(double.nan, 77.2090), isNull);
    });

    test('returns null for NaN lng', () {
      expect(sanitizeLatLng(28.6139, double.nan), isNull);
    });

    test('returns null when both are NaN', () {
      expect(sanitizeLatLng(double.nan, double.nan), isNull);
    });

    test('returns null for positive infinity lat', () {
      expect(sanitizeLatLng(double.infinity, 77.2090), isNull);
    });

    test('returns null for negative infinity lng', () {
      expect(sanitizeLatLng(28.6139, double.negativeInfinity), isNull);
    });

    test('returns null when lat is above +90', () {
      expect(sanitizeLatLng(91, 0), isNull);
    });

    test('returns null when lat is below -90', () {
      expect(sanitizeLatLng(-91, 0), isNull);
    });

    test('returns null when lng is above +180', () {
      expect(sanitizeLatLng(0, 181), isNull);
    });

    test('returns null when lng is below -180', () {
      expect(sanitizeLatLng(0, -181), isNull);
    });

    test('returns null for the (0, 0) no-fix sentinel', () {
      expect(sanitizeLatLng(0.0, 0.0), isNull);
    });
  });

  group('sanitizeLatLngPoint', () {
    test('returns null for null input', () {
      expect(sanitizeLatLngPoint(null), isNull);
    });

    test('sanitizes an already-built NaN LatLng', () {
      expect(sanitizeLatLngPoint(const LatLng(double.nan, double.nan)), isNull);
    });

    test('passes through a valid LatLng', () {
      final point = sanitizeLatLngPoint(const LatLng(28.6139, 77.2090));
      expect(point, isA<LatLng>());
      expect(point!.latitude, 28.6139);
    });
  });

  group('isFiniteLatLng', () {
    test('false for non-finite and null, true for valid', () {
      expect(isFiniteLatLng(null), isFalse);
      expect(isFiniteLatLng(const LatLng(double.nan, double.nan)), isFalse);
      expect(isFiniteLatLng(const LatLng(0, 0)), isFalse);
      expect(isFiniteLatLng(const LatLng(28.6139, 77.2090)), isTrue);
    });
  });

  group('defaults', () {
    test('default center is a real Delhi NCR coordinate, not (0,0)', () {
      expect(kServiQDefaultCenter.latitude, isNot(0.0));
      expect(kServiQDefaultCenter.longitude, isNot(0.0));
      expect(sanitizeLatLngPoint(kServiQDefaultCenter), isNotNull);
    });
  });
}
