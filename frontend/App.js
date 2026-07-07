import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { darkTheme, lightTheme } from './src/theme';
import { pingBackend } from './src/services/api';

export default function App() {
  const colorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(colorScheme === 'dark');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    setIsDark(colorScheme === 'dark');
    
    // Ping backend on startup to confirm connection
    pingBackend();
  }, [colorScheme]);

  const theme = isDark ? darkTheme : lightTheme;

  if (showSplash) {
    return (
      <>
        <StatusBar hidden />
        <SplashScreen theme={theme} onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
      <RootNavigator theme={theme} />
    </>
  );
}
