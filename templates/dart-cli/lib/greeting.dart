String greeting(String name) {
  final recipient = name.trim();
  return 'Hello, ${recipient.isEmpty ? 'world' : recipient}!';
}
