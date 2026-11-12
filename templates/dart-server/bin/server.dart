import 'dart:io';

import 'package:app___PROJECT_SNAKE__/server.dart';

Future<void> main() async {
  final port = int.tryParse(Platform.environment['PORT'] ?? '') ?? 8080;
  final server = await startServer(port: port);
  stdout.writeln('Listening on http://${server.address.address}:${server.port}');
}
