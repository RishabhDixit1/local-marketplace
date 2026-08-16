import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/utils/app_formatters.dart';

void main() {
  group('AppFormatters.cleanPersonName', () {
    test('fixes mangled concatenated person names', () {
      expect(
        AppFormatters.cleanPersonName('chaturvedChakori ChaturvediichakoriC'),
        'Chaturved Chakori',
      );
      expect(
        AppFormatters.cleanPersonName('harpreetSingh harpreetsingh'),
        'Harpreet Singh',
      );
    });

    test('leaves clean names untouched', () {
      expect(AppFormatters.cleanPersonName('Mary Jane'), 'Mary Jane');
      expect(AppFormatters.cleanPersonName('Chaturvedi Chakori'), 'Chaturvedi Chakori');
      expect(AppFormatters.cleanPersonName('Kushagra Sharma'), 'Kushagra Sharma');
      expect(AppFormatters.cleanPersonName(null), '');
      expect(AppFormatters.cleanPersonName(''), '');
      expect(AppFormatters.cleanPersonName('  '), '');
    });

    test('leaves business titles and brands untouched', () {
      expect(
        AppFormatters.cleanPersonName(
          'AquaRepublik RO Service (Crossing Republik)',
        ),
        'AquaRepublik RO Service (Crossing Republik)',
      );
      expect(
        AppFormatters.cleanPersonName('BrightFixIndia'),
        'BrightFixIndia',
      );
      expect(
        AppFormatters.cleanPersonName('BForBicycle'),
        'BForBicycle',
      );
      expect(
        AppFormatters.cleanPersonName('ServiQ E2E User'),
        'ServiQ E2E User',
      );
      expect(
        AppFormatters.cleanPersonName(
          'Samsung Experience Store Crossings Republik',
        ),
        'Samsung Experience Store Crossings Republik',
      );
      expect(
        AppFormatters.cleanPersonName('R.K. AC,Washing Machine & Fridge Repair Shop'),
        'R.K. AC,Washing Machine & Fridge Repair Shop',
      );
    });

    test('normalizes whitespace', () {
      expect(
        AppFormatters.cleanPersonName('  Aayu   Aircon  '),
        'Aayu Aircon',
      );
    });
  });
}
