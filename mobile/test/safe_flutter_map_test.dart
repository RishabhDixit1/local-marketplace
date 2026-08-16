import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

import 'package:serviq_mobile/shared/components/safe_flutter_map.dart';

// 256x256 white tile, base64 encoded (same pattern flutter_map uses in tests).
const _whiteTile =
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAANQTFRF////p8QbyAAAAB9JREFUeJztwQENAAAAwqD3T20ON6AAAAAAAAAAAL4NIQAAAfFnIe4AAAAASUVORK5CYII=';

class _TinyTileProvider extends TileProvider {
  @override
  ImageProvider<Object> getImage(
    TileCoordinates coordinates,
    TileLayer options,
  ) => MemoryImage(base64Decode(_whiteTile));
}

const _delhi = LatLng(28.6139, 77.2090);

Future<void> _pumpMap(
  WidgetTester tester, {
  LatLng? center,
  List<Marker> markers = const [],
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 400,
            height: 400,
            child: SafeFlutterMap(
              center: center,
              markers: markers,
              tileProvider: _TinyTileProvider(),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

Marker _marker(LatLng point, String label) => Marker(
  point: point,
  width: 36,
  height: 36,
  child: Center(
    child: Text(label, style: const TextStyle(color: Colors.white)),
  ),
);

void main() {
  testWidgets('renders valid markers and omits NaN markers', (tester) async {
    await _pumpMap(
      tester,
      center: _delhi,
      markers: [
        _marker(_delhi, 'valid pin'),
        _marker(const LatLng(double.nan, double.nan), 'broken pin'),
        _marker(const LatLng(0.0, 0.0), 'sentinel pin'),
      ],
    );

    expect(find.byType(FlutterMap), findsOneWidget);
    expect(find.text('valid pin'), findsOneWidget);
    expect(find.text('broken pin'), findsNothing);
    expect(find.text('sentinel pin'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('falls back to the safe default center when center is null', (
    tester,
  ) async {
    await _pumpMap(tester, center: null);

    expect(find.byType(FlutterMap), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('falls back to the safe default center for NaN center', (
    tester,
  ) async {
    await _pumpMap(
      tester,
      center: const LatLng(double.nan, double.nan),
      markers: [_marker(_delhi, 'valid pin')],
    );

    expect(find.byType(FlutterMap), findsOneWidget);
    expect(find.text('valid pin'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pinch-zoom with a finite camera does not crash', (tester) async {
    await _pumpMap(
      tester,
      center: _delhi,
      markers: [_marker(_delhi, 'valid pin')],
    );

    final mapCenter = tester.getCenter(find.byType(FlutterMap));
    final fingerA = await tester.createGesture();
    final fingerB = await tester.createGesture();
    await fingerA.down(mapCenter - const Offset(40, 0));
    await fingerB.down(mapCenter + const Offset(40, 0));
    await tester.pump();
    await fingerA.moveBy(const Offset(-30, 0));
    await fingerB.moveBy(const Offset(30, 0));
    await tester.pump();
    await fingerA.moveBy(const Offset(-30, 0));
    await fingerB.moveBy(const Offset(30, 0));
    await tester.pump();
    await fingerA.up();
    await fingerB.up();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(tester.takeException(), isNull);
  });

  testWidgets('panning the map does not crash', (tester) async {
    await _pumpMap(
      tester,
      center: _delhi,
      markers: [_marker(_delhi, 'valid pin')],
    );

    await tester.drag(find.byType(FlutterMap), const Offset(-80, -60));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(tester.takeException(), isNull);
  });
}
