import { Text, TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { colors: c, homeOnly } = useTheme();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTintColor: c.textPrimary,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mis gastos',
          tabBarLabel: 'Inicio',
          href: homeOnly ? null : '/',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🐷</Text>,
        }}
      />
      <Tabs.Screen
        name="hogar"
        options={{
          title: 'Hogar compartido',
          tabBarLabel: 'Hogar',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/settings')} style={{ paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 18, color: c.primary }}>⚙︎</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}
