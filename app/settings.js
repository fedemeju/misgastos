import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, Switch } from 'react-native';
import { getSetting, setSetting } from '../src/db';
import { exportBackup, importBackup } from '../src/backup';
import { useTheme } from '../src/theme';

const THEME_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
];

export default function Settings() {
  const { colors: c, pref, setPref, homeOnly, setHomeOnly } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [lockAccounts, setLockAccounts] = useState(true);

  useEffect(() => {
    getSetting('gemini_api_key').then((v) => v && setKey(v));
    getSetting('lock_accounts').then((v) => setLockAccounts(v !== 'off'));
  }, []);

  function toggleLock(v) {
    setLockAccounts(v);
    setSetting('lock_accounts', v ? 'on' : 'off');
  }

  async function doExport() {
    try {
      await exportBackup();
    } catch (e) {
      Alert.alert('No se pudo exportar', String(e.message || e));
    }
  }

  function doImport() {
    Alert.alert(
      'Importar backup',
      'Esto reemplaza TODOS los datos actuales (gastos, saldos, deudas) por los del archivo. ¿Seguir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          style: 'destructive',
          onPress: async () => {
            try {
              const r = await importBackup();
              if (r) Alert.alert('Listo', `Se restauraron ${r.expenses} gastos, ${r.accounts} cuentas y ${r.debts} deudas.`);
            } catch (e) {
              Alert.alert('No se pudo importar', String(e.message || e));
            }
          },
        },
      ]
    );
  }

  async function save() {
    await setSetting('gemini_api_key', key.trim());
    setSaved(true);
    Alert.alert('Listo', 'La API key se guardó en tu teléfono.');
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Apariencia</Text>
      <Text style={styles.text}>Elegí el modo de la app. "Auto" sigue el modo noche de tu teléfono.</Text>
      <View style={styles.segment}>
        {THEME_OPTIONS.map((opt) => {
          const active = pref === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => setPref(opt.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.title, { marginTop: 30 }]}>Modo de la app</Text>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.switchLabel}>Solo hogar</Text>
          <Text style={styles.switchSub}>Muestra únicamente la sección Hogar (para el teléfono de tu pareja). Oculta tus gastos personales.</Text>
        </View>
        <Switch
          value={homeOnly}
          onValueChange={setHomeOnly}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor="#fff"
        />
      </View>

      <Text style={[styles.title, { marginTop: 30 }]}>Seguridad</Text>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.switchLabel}>Pedir huella para ver Saldos</Text>
          <Text style={styles.switchSub}>Protegé tus saldos con tu huella o rostro.</Text>
        </View>
        <Switch
          value={lockAccounts}
          onValueChange={toggleLock}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor="#fff"
        />
      </View>

      <Text style={[styles.title, { marginTop: 30 }]}>Backup de datos</Text>
      <Text style={styles.text}>Tus datos viven solo en el teléfono. Exportá un archivo y guardalo en Drive o donde quieras.</Text>
      <View style={styles.backupRow}>
        <TouchableOpacity style={[styles.backupBtn, { backgroundColor: c.primary }]} onPress={doExport}>
          <Text style={[styles.backupBtnText, { color: c.onPrimary }]}>Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backupBtn, styles.backupBtnGhost]} onPress={doImport}>
          <Text style={[styles.backupBtnText, { color: c.textPrimary }]}>Importar</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.title, { marginTop: 30 }]}>API key de Gemini</Text>
      <Text style={styles.text}>
        Para leer tickets y facturas la app usa Google Gemini, que tiene una capa gratuita. Necesitás una API key propia (gratis).
      </Text>

      <View style={styles.steps}>
        <Text style={styles.step}>1. Entrá a Google AI Studio y creá una API key.</Text>
        <Text style={styles.step}>2. Copiala y pegala acá abajo.</Text>
        <Text style={styles.step}>3. Guardá. Listo, ya podés escanear.</Text>
      </View>

      <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}>
        <Text style={styles.linkText}>Abrir Google AI Studio ↗</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Tu API key</Text>
      <TextInput
        style={styles.input}
        value={key}
        onChangeText={(t) => { setKey(t); setSaved(false); }}
        placeholder="AQ... o AIza..."
        placeholderTextColor={c.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveText}>{saved ? '✓ Guardada' : 'Guardar'}</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        La key se guarda solo en tu teléfono, en la base de datos local de la app. No se comparte con nadie más que Google al leer un comprobante.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '600', color: c.textPrimary, marginBottom: 8 },
  text: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  segment: { flexDirection: 'row', backgroundColor: c.subtle, borderRadius: 12, padding: 4, marginTop: 14 },
  segmentItem: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentItemActive: { backgroundColor: c.card },
  segmentText: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
  segmentTextActive: { color: c.primary, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: c.border },
  switchLabel: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  switchSub: { fontSize: 12, color: c.textMuted, marginTop: 3, lineHeight: 16 },
  backupRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  backupBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backupBtnGhost: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  backupBtnText: { fontSize: 15, fontWeight: '600' },
  steps: { backgroundColor: c.card, borderRadius: 12, padding: 14, marginTop: 14, gap: 8, borderWidth: 1, borderColor: c.border },
  step: { fontSize: 13, color: c.textPrimary },
  linkBtn: { marginTop: 14, alignSelf: 'flex-start' },
  linkText: { color: c.primary, fontSize: 14, fontWeight: '500' },
  label: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 22, marginBottom: 6 },
  input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: c.textPrimary },
  saveBtn: { backgroundColor: c.primary, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  saveText: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  note: { fontSize: 12, color: c.textMuted, marginTop: 18, lineHeight: 18 },
});
