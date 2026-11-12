import 'package:app___PROJECT_SNAKE__/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('switches tabs and keeps the counter state', (tester) async {
    await tester.pumpWidget(const MobileApp());
    await tester.tap(find.text('Increment'));
    await tester.pumpAndSettle();
    expect(find.text('1'), findsOneWidget);

    await tester.tap(find.text('About'));
    await tester.pumpAndSettle();
    expect(find.text('Reset counter'), findsOneWidget);

    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.text('1'), findsOneWidget);
  });
}
