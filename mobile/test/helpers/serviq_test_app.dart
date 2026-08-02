import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'package:serviq_mobile/l10n/l10n.dart';

const kServiqTestLocalizationsDelegates = <LocalizationsDelegate<dynamic>>[
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
  AppLocalizations.delegate,
];

const kServiqTestSupportedLocales = <Locale>[
  Locale('en', 'US'),
  Locale('hi', 'IN'),
  Locale('bn', 'BD'),
  Locale('ta', 'IN'),
  Locale('te', 'IN'),
  Locale('mr', 'IN'),
];
