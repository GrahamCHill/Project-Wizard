import 'package:app___PROJECT_SNAKE__/greeting.dart';
import 'package:test/test.dart';

void main() {
  test('greets the requested person and defaults to world', () {
    expect(greeting(' Ada '), 'Hello, Ada!');
    expect(greeting(''), 'Hello, world!');
  });
}
