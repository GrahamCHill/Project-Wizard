import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: require('react-native').View,
}));

test('switches tabs and keeps the counter state', () => {
  let screen!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    screen = ReactTestRenderer.create(<App />);
  });
  const press = (label: string) => {
    const button = screen.root.findAllByProps({ testID: label })
      .find(node => typeof node.props.onPress === 'function');
    expect(button).toBeDefined();
    act(() => button!.props.onPress());
  };
  press('increment-counter');
  press('tab-about');
  expect(screen.root.findAllByProps({ testID: 'reset-counter' }).length).toBeGreaterThan(0);
  press('tab-home');
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Count: 1' }).length).toBeGreaterThan(0);
  act(() => screen.unmount());
});
