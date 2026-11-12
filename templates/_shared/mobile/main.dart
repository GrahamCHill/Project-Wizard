import 'package:flutter/material.dart';

void main() => runApp(const MobileApp());

class MobileApp extends StatelessWidget {
  const MobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '__PROJECT_NAME__',
      theme: ThemeData(colorSchemeSeed: Colors.indigo),
      home: const MobileTabs(),
    );
  }
}

class MobileTabs extends StatefulWidget {
  const MobileTabs({super.key});

  @override
  State<MobileTabs> createState() => _MobileTabsState();
}

class _MobileTabsState extends State<MobileTabs> {
  int tab = 0;
  int count = 0;

  @override
  Widget build(BuildContext context) {
    final title = tab == 0 ? '__PROJECT_NAME__' : 'About';
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: tab == 0
                ? [
                    Text('$count', style: Theme.of(context).textTheme.displayLarge),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => setState(() => count++),
                      child: const Text('Increment'),
                    ),
                  ]
                : [
                    const Text('A two-screen starter for __PROJECT_NAME__.'),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => setState(() => count = 0),
                      child: const Text('Reset counter'),
                    ),
                  ],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (value) => setState(() => tab = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.info_outline), label: 'About'),
        ],
      ),
    );
  }
}
