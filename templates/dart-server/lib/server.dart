import 'dart:convert';
import 'dart:io';

Future<HttpServer> startServer({int port = 8080}) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  server.listen(_handleRequest);
  return server;
}

Future<void> _handleRequest(HttpRequest request) async {
  final response = request.response;
  response.headers.contentType = ContentType.json;
  if (request.method != 'GET') {
    response.statusCode = HttpStatus.methodNotAllowed;
    response.headers.set(HttpHeaders.allowHeader, 'GET');
    response.write(jsonEncode({'error': 'Method not allowed'}));
  } else {
    switch (request.uri.path) {
      case '/':
        response.write(jsonEncode({'message': 'Hello from __PROJECT_NAME__'}));
      case '/health':
        response.write(jsonEncode({'status': 'ok'}));
      default:
        response.statusCode = HttpStatus.notFound;
        response.write(jsonEncode({'error': 'Not found'}));
    }
  }
  await response.close();
}
