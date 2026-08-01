import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getDueReminders, addDueReminder, deleteDueReminder } from '../src/db';
import { formatMoney, formatAmountInput, parseAmountInput } from '../src/format';
import { scheduleDueNotification, cancelDueNotification } from '../src/reminders';
import { useTheme } from '../src/theme';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function pad(n) { return String(n).padStart(2, '0'); }

function subtitle(r) {
  const hm = `${pad(r.hour ?? 9)}:${pad(r.minute ?? 0)}`;
  if (r.kind === 'once' && r.date) {
    const [y, m, d] = r.date.split('-').map(Number);
    return `El ${d} de ${MESES[(m || 1) - 1]} de ${y} · ${hm}`;
  }
  return `Todos los meses el día ${r.day} · ${hm}`;
}

function parseTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || '').trim());
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return { h, mi };
}

export default function Vencimientos() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState([]);
  const [addOpen, setAddOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('monthly');
  const [day, setDay] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');

  const load = useCallback(() => { getDueReminders().then(setItems); }, []);
  useFocusEffect(load);

  function resetForm() {
    setTitle(''); setAmount(''); setKind('monthly'); setDay('');
    setDate(new Date().toISOString().slice(0, 10)); setTime('09:00');
  }

  async function create() {
    if (!title.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre (ej: Tarjeta Visa).');
    const t = parseTime(time);
    if (!t) return Alert.alert('Hora inválida', 'Usá el formato HH:MM (ej. 09:00).');

    let dayVal = null;
    let dateVal = null;
    if (kind === 'monthly') {
      dayVal = parseInt(day, 10);
      if (!dayVal || dayVal < 1 || dayVal > 28) {
        return Alert.alert('Día inválido', 'Para avisos mensuales elegí un día del 1 al 28.');
      }
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');
      const d = new Date(`${date}T00:00:00`);
      d.setHours(t.h, t.mi, 0, 0);
      if (isNaN(d.getTime())) return Alert.alert('Fecha inválida', 'Revisá la fecha.');
      if (d.getTime() <= Date.now()) return Alert.alert('Fecha pasada', 'Elegí una fecha futura.');
      dateVal = date;
    }

    const payload = {
      title: title.trim(),
      amount: amount.trim() ? parseAmountInput(amount) : null,
      kind, day: dayVal, date: dateVal, hour: t.h, minute: t.mi,
    };
    const notifId = await scheduleDueNotification(payload);
    await addDueReminder({ ...payload, notifId });
    if (!notifId) {
      Alert.alert('Guardado sin aviso', 'No se pudo programar la notificación. Activá los permisos de notificaciones de la app para recibir el aviso.');
    }
    setAddOpen(false);
    resetForm();
    load();
  }

  function confirmDelete(r) {
    Alert.alert('Borrar aviso', `¿Borrar el aviso de "${r.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar', style: 'destructive',
        onPress: async () => { await cancelDueNotification(r.notif_id); await deleteDueReminder(r.id); load(); },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Cargá los vencimientos de tus tarjetas y deudas. La app te manda una notificación el día que le digas.</Text>

        {items.length === 0 && <Text style={styles.empty}>Todavía no cargaste ningún vencimiento.</Text>}

        {items.map((r) => (
          <TouchableOpacity key={r.id} style={styles.card} activeOpacity={0.7} onLongPress={() => confirmDelete(r)}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{r.kind === 'once' ? '🔔' : '🔁'}  {r.title}</Text>
              {r.amount ? <Text style={styles.amount}>{formatMoney(r.amount)}</Text> : null}
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.meta}>{subtitle(r)}</Text>
              {!r.notif_id && <Text style={styles.noNotif}>sin aviso</Text>}
            </View>
          </TouchableOpacity>
        ))}

        {items.length > 0 && <Text style={styles.tinyHint}>Mantené presionado un aviso para borrarlo.</Text>}

        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>+  Agregar vencimiento</Text>
        </TouchableOpacity>
      </ScrollView>

      {addOpen && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior="padding">
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setAddOpen(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetTitle}>Nuevo vencimiento</Text>

                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ej: Tarjeta Visa, Cuota préstamo" placeholderTextColor={c.textFaint} />

                <Text style={styles.inputLabel}>Monto (opcional)</Text>
                <TextInput style={styles.input} value={amount} onChangeText={(t) => setAmount(formatAmountInput(t))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textFaint} />

                <Text style={styles.inputLabel}>¿Cada cuánto?</Text>
                <View style={styles.curRow}>
                  {[{ k: 'monthly', l: 'Todos los meses' }, { k: 'once', l: 'Una sola vez' }].map((o) => {
                    const active = kind === o.k;
                    return (
                      <TouchableOpacity key={o.k} style={[styles.curChip, active && styles.curChipActive]} onPress={() => setKind(o.k)}>
                        <Text style={[styles.curChipText, active && styles.curChipTextActive]}>{o.l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {kind === 'monthly' ? (
                  <>
                    <Text style={styles.inputLabel}>Día del mes (1 a 28)</Text>
                    <TextInput style={styles.input} value={day} onChangeText={(t) => setDay(t.replace(/[^\d]/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="Ej: 10" placeholderTextColor={c.textFaint} />
                  </>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Fecha (AAAA-MM-DD)</Text>
                    <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-08-15" placeholderTextColor={c.textFaint} keyboardType="numbers-and-punctuation" />
                  </>
                )}

                <Text style={styles.inputLabel}>Hora del aviso (HH:MM)</Text>
                <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="09:00" placeholderTextColor={c.textFaint} keyboardType="numbers-and-punctuation" />

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => { setAddOpen(false); resetForm(); }}><Text style={styles.btnGhostText}>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={create}><Text style={styles.btnPrimaryText}>Crear</Text></TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  intro: { fontSize: 13, color: c.textSecondary, marginBottom: 16, lineHeight: 18 },
  empty: { fontSize: 13, color: c.textMuted, marginBottom: 12 },
  card: { backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: c.textPrimary, flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 12, color: c.textSecondary, marginTop: 6 },
  noNotif: { fontSize: 11, color: c.danger, marginTop: 6, fontWeight: '500' },
  tinyHint: { color: c.textFaint, fontSize: 11, marginTop: 4, marginBottom: 14, textAlign: 'center' },
  addBtn: { marginTop: 6, height: 50, borderRadius: 12, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, color: c.primary, fontWeight: '500' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, textAlign: 'center', marginBottom: 4 },
  inputLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16, color: c.textPrimary },
  curRow: { flexDirection: 'row', gap: 8 },
  curChip: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  curChipActive: { backgroundColor: c.selectedBg, borderColor: c.primary },
  curChipText: { fontSize: 14, color: c.textSecondary },
  curChipTextActive: { color: c.primary, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: c.subtle },
  btnGhostText: { fontSize: 15, color: c.textPrimary, fontWeight: '500' },
  btnPrimary: { backgroundColor: c.primary },
  btnPrimaryText: { fontSize: 15, color: c.onPrimary, fontWeight: '600' },
});
