import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, Switch } from 'react-native';
import * as Updates from 'expo-updates';
import { getSetting, setSetting } from '../src/db';
import { exportBackup, importBackup } from '../src/backup';
import { scheduleDailyReminder, cancelReminder, DEFAULT_MSG } from '../src/reminders';
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
  const [remOn, setRemOn] = useState(false);
  const [remTime, setRemTime] = useState('21:00');
  const [remMsg, setRemMsg] = useState(DEFAULT_MSG);
  const [checkingUpd, setCheckingUpd] = useState(false);

  async function checkForUpdate() {
    if (!Updates.isEnabled) {
      return Alert.alert('No disponible', 'Las actualizaciones automáticas no están activas en esta versión (modo desarrollo).');
    }
    setCheckingUpd(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Actualización lista', 'Se descargó la última versión. La app se va a reiniciar para aplicarla.', [
          { text: 'Aplicar ahora', onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert('Todo al día', 'Ya tenés la última versión instalada.');
      }
    } catch {
      Alert.alert('No se pudo actualizar', 'Revisá tu conexión a internet e intentá de nuevo.');
    } finally {
      setCheckingUpd(false);
    }
  }

  useEffect(() => {
    getSetting('gemini_api_key').then((v) => v && setKey(v));
    getSetting('lock_accounts').then((v) => setLockAccounts(v !== 'off'));
    getSetting('reminder_on').then((v) => setRemOn(v === 'on'));
    getSetting('reminder_time').then((v) => v && setRemTime(v));
    getSetting('reminder_msg').then((v) => v && setRemMsg(v));
  }, []);

  function parseTime(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m) return null;
    const h = Number(m[1]); const mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return { h, mi };
  }

  async function toggleReminder(v) {
    if (v) {
      const t = parseTime(remTime) || { h: 21, mi: 0 };
      const ok = await scheduleDailyReminder(t.h, t.mi, remMsg.trim() || DEFAULT_MSG);
      if (!ok) { Alert.alert('Permiso necesario', 'Activá las notificaciones de la app para recibir el recordatorio.'); return; }
      setRemOn(true);
      await setSetting('reminder_on', 'on');
    } else {
      await cancelReminder();
      setRemOn(false);
      await setSetting('reminder_on', 'off');
    }
  }

  async function saveReminder() {
    const t = parseTime(remTime);
    if (!t) return Alert.alert('Hora inválida', 'Usá el formato HH:MM (ej. 21:30).');
    await setSetting('reminder_time', remTime.trim());
    await setSetting('reminder_msg', remMsg.trim() || DEFAULT_MSG);
    if (remOn) {
      await scheduleDailyReminder(t.h, t.mi, remMsg.trim() || DEFAULT_MSG);
      Alert.alert('Listo', `Te voy a recordar todos los días a las ${remTime}.`);
    }
  }

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
      <Text style={styles.title}>Actualizaciones</Text>
      <Text style={styles.text}>Traé las últimas mejoras sin reinstalar la app.</Text>
      <TouchableOpacity style={[styles.updBtn, checkingUpd && { opacity: 0.6 }]} onPress={checkForUpdate} disabled={checkingUpd}>
        <Text style={styles.updBtnText}>{checkingUpd ? 'Buscando…' : '⟳  Buscar actualización'}</Text>
      </TouchableOpacity>
      <Text style={styles.updInfo}>
        {Updates.createdAt ? `Versión del ${Updates.createdAt.toLocaleDateString('es-AR')} ${Updates.createdAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Versión de desarrollo'}
      </Text>

      <Text style={[styles.title, { marginTop: 30 }]}>Apariencia</Text>
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

      <Text style={[styles.title, { marginTop: 30 }]}>Recordatorio diario</Text>
      <View style={styles.switchRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.switchLabel}>Recordarme cargar los gastos</Text>
          <Text style={styles.switchSub}>Una notificación por día a la hora que elijas.</Text>
        </View>
        <Switch value={remOn} onValueChange={toggleReminder} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />
      </View>
      <Text style={styles.label}>Hora (HH:MM)</Text>
      <TextInput style={styles.input} value={remTime} onChangeText={setRemTime} placeholder="21:00" placeholderTextColor={c.textFaint} keyboardType="numbers-and-punctuation" />
      <Text style={styles.label}>Mensaje</Text>
      <TextInput style={styles.input} value={remMsg} onChangeText={setRemMsg} placeholder={DEFAULT_MSG} placeholderTextColor={c.textFaint} />
      <TouchableOpacity style={styles.saveBtn} onPress={saveReminder}>
        <Text style={styles.saveText}>Guardar recordatorio</Text>
      </TouchableOpacity>

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
  updBtn: { height: 48, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  updBtnText: { fontSize: 15, color: c.primary, fontWeight: '600' },
  updInfo: { fontSize: 11, color: c.textFaint, marginTop: 8, textAlign: 'center' },
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
