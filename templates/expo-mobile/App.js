import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const tabs = ['Home', 'About'];

export default function App() {
  const [tab, setTab] = useState('Home');
  const [count, setCount] = useState(0);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>
            {tab === 'Home' ? '__PROJECT_NAME__' : 'About'}
          </Text>
          {tab === 'Home' ? (
            <>
              <Text style={styles.count} accessibilityLabel={`Count: ${count}`}>{count}</Text>
              <Pressable testID="increment-counter" accessibilityRole="button" style={styles.button} onPress={() => setCount(value => value + 1)}>
                <Text style={styles.buttonText}>Increment</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.description}>A two-screen starter for __PROJECT_NAME__.</Text>
              <Pressable testID="reset-counter" accessibilityRole="button" style={styles.button} onPress={() => setCount(0)}>
                <Text style={styles.buttonText}>Reset counter</Text>
              </Pressable>
            </>
          )}
        </View>
        <View accessibilityRole="tablist" style={styles.tabs}>
          {tabs.map(item => (
            <Pressable
              key={item}
              testID={`tab-${item.toLowerCase()}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item && styles.selectedTab]}
            >
              <Text style={[styles.tabText, tab === item && styles.selectedText]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { color: '#182337', fontSize: 30, fontWeight: '700', textAlign: 'center' },
  count: { color: '#182337', fontSize: 48, fontVariant: ['tabular-nums'] },
  description: { color: '#43526a', fontSize: 16, textAlign: 'center' },
  button: { backgroundColor: '#2454a3', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { color: '#ffffff', fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#d7dfec' },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabText: { color: '#43526a', fontWeight: '600' },
  selectedTab: { backgroundColor: '#dfeaff' },
  selectedText: { color: '#153e7f' }
});
