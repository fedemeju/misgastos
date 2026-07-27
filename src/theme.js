import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from './db';

// Paletas. Los colores de categoría (src/categories.js) se usan con transparencia
// y funcionan en ambos modos, así que no se tocan acá.

export const LIGHT = {
  mode: 'light',
  bg: '#F6F7F6',
  card: '#FFFFFF',
  border: '#E0E3E0',
  textPrimary: '#12130F',
  textSecondary: '#5F615A',
  textMuted: '#8A8B84',
  textFaint: '#A9AAA3',
  primary: '#0E7C66',
  onPrimary: '#FFFFFF',
  subtle: '#EEF2F0',
  barBg: '#E7EAE8',
  danger: '#E24B4A',
  selectedBg: '#EAF5F0',
  banner: '#E3F3EC',
  bannerText: '#0E6E56',
  neutralBanner: '#EEF2F0',
};

export const DARK = {
  mode: 'dark',
  bg: '#121417',
  card: '#1D2025',
  border: '#2C3037',
  textPrimary: '#F1F2F1',
  textSecondary: '#AEB2B7',
  textMuted: '#868B92',
  textFaint: '#6E737A',
  primary: '#2CB48D',
  onPrimary: '#06231C',
  subtle: '#262A30',
  barBg: '#2A2F35',
  danger: '#F0655F',
  selectedBg: '#173A30',
  banner: '#123328',
  bannerText: '#7FD9BA',
  neutralBanner: '#242830',
};

const ThemeContext = createContext({ colors: LIGHT, pref: 'auto', setPref: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [pref, setPrefState] = useState('auto'); // 'auto' | 'light' | 'dark'
  const [homeOnly, setHomeOnlyState] = useState(false); // modo "solo hogar" (para la pareja)

  useEffect(() => {
    getSetting('theme').then((v) => { if (v) setPrefState(v); });
    getSetting('home_only').then((v) => setHomeOnlyState(v === 'on'));
  }, []);

  const mode = pref === 'auto' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const colors = mode === 'dark' ? DARK : LIGHT;

  function setPref(next) {
    setPrefState(next);
    setSetting('theme', next);
  }

  function setHomeOnly(v) {
    setHomeOnlyState(v);
    setSetting('home_only', v ? 'on' : 'off');
  }

  return (
    <ThemeContext.Provider value={{ colors, pref, setPref, homeOnly, setHomeOnly }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
