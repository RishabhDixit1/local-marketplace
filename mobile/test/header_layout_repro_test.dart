import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/theme/app_theme.dart';

void main() {
  testWidgets('landing header buttons render in unbounded Row', (tester) async {
    Widget buildHeader() {
      return SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [Text('ServiQ')],
                      ),
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: () {},
                          icon: const Icon(Icons.search_rounded, size: 20),
                        ),
                        FilledButton.tonalIcon(
                          onPressed: () {},
                          label: const Text('Sign In'),
                          icon: const Icon(Icons.login_rounded, size: 16),
                          style: FilledButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(body: buildHeader()),
      ),
    );

    final RenderBox signInBox = tester.renderObject(find.text('Sign In'));
    expect(signInBox.size.height, greaterThan(0));
    expect(signInBox.size.width, lessThan(400));
    expect(tester.takeException(), isNull);
  });
}
