import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { initDb } from '../src/db';
import { ThemeProvider, useTheme } from '../src/theme';
import { applyReminderFromSettings } from '../src/reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function ThemedStack() {
  const { colors: c } = useTheme();
  return (
    <>
      <StatusBar style={c.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerShadowVisible: false,
          headerTintColor: c.textPrimary,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="manual" options={{ title: 'Cargar gasto', presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ title: 'Escanear ticket', presentation: 'modal' }} />
        <Stack.Screen name="category" options={{ title: 'Categoría' }} />
        <Stack.Screen name="statement" options={{ title: 'Resumen' }} />
        <Stack.Screen name="accounts" options={{ title: 'Saldos' }} />
        <Stack.Screen name="analysis" options={{ title: 'Análisis' }} />
        <Stack.Screen name="debts" options={{ title: 'Deudas' }} />
        <Stack.Screen name="debt" options={{ title: 'Deuda' }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb().then(() => {
      setReady(true);
      applyReminderFromSettings();
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F7F6' }}>
        <ActivityIndicator size="large" color="#0E7C66" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}
