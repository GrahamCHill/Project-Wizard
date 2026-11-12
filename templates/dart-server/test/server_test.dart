import 'dart:convert';
import 'dart:io';

import 'package:app___PROJECT_SNAKE__/server.dart';
import 'package:test/test.dart';

void main() {
  test('serves the health route and returns 404 for an unknown route', () async {
    final server = await startServer(port: 0);
    addTearDown(() => server.close(force: true));
    final client = HttpClient();
    addTearDown(() => client.close(force: true));

    final base = Uri.http('127.0.0.1:${server.port}');
    final health = await (await client.getUrl(base.resolve('/health'))).close();
    expect(health.statusCode, HttpStatus.ok);
    expect(jsonDecode(await utf8.decoder.bind(health).join()), {'status': 'ok'});

    final missing = await (await client.getUrl(base.resolve('/missing'))).close();
    expect(missing.statusCode, HttpStatus.notFound);
    await missing.drain<void>();
  });
}
