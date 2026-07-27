import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDebts, addDebt } from '../src/db';
import { formatBalance } from '../src/format';
import { useTheme } from '../src/theme';

export default function Debts() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [debts, setDebts] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [total, setTotal] = useState('');
  const [currency, setCurrency] = useState('ARS');

  const load = useCallback(() => { getDebts().then(setDebts); }, []);
  useFocusEffect(load);

  async function create() {
    if (!name.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre a la deuda.');
    const t = parseFloat(String(total).replace(',', '.')) || 0;
    await addDebt({ name: name.trim(), total: t, currency });
    setAddOpen(false); setName(''); setTotal(''); setCurrency('ARS');
    load();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Registrá tus deudas y anotá cada pago con su fecha.</Text>

        {debts.length === 0 && <Text style={styles.empty}>Todavía no cargaste ninguna deuda.</Text>}

        {debts.map((d) => {
          const remaining = d.total > 0 ? d.total - d.paid : null;
          const pct = d.total > 0 ? Math.min(100, Math.round((d.paid / d.total) * 100)) : 0;
          return (
            <TouchableOpacity key={d.id} style={styles.card} activeOpacity={0.7} onPress={() => router.push({ pathname: '/debt', params: { id: d.id } })}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{d.name}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              {d.total > 0 ? (
                <>
                  <View style={styles.barBg}><View style={[styles.barFill, { width: `${pct}%` }]} /></View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.meta}>Pagado {formatBalance(d.paid, d.currency)} de {formatBalance(d.total, d.currency)}</Text>
                    <Text style={styles.remaining}>Resta {formatBalance(remaining, d.currency)}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.meta}>Pagado {formatBalance(d.paid, d.currency)} · {d.payments} pago{d.payments !== 1 ? 's' : ''}</Text>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>+  Agregar deuda</Text>
        </TouchableOpacity>
      </ScrollView>

      {addOpen && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setAddOpen(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Nueva deuda</Text>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Préstamo a Juan" placeholderTextColor={c.textFaint} />
              <Text style={styles.inputLabel}>Moneda</Text>
              <View style={styles.curRow}>
                {['ARS', 'USD'].map((cur) => {
                  const active = currency === cur;
                  return (
                    <TouchableOpacity key={cur} style={[styles.curChip, active && styles.curChipActive]} onPress={() => setCurrency(cur)}>
                      <Text style={[styles.curChipText, active && styles.curChipTextActive]}>{cur === 'ARS' ? 'Pesos' : 'Dólares'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.inputLabel}>Monto total (opcional)</Text>
              <TextInput style={styles.input} value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textFaint} />
              <Text style={styles.help}>Si ponés el total, la app te muestra cuánto falta pagar.</Text>
              <View style={styles.sheetActions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setAddOpen(false)}><Text style={styles.btnGhostText}>Cancelar</Text></TouchableOpacity>
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
  name: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  chevron: { fontSize: 20, color: c.textMuted },
  barBg: { height: 7, backgroundColor: c.barBg, borderRadius: 99, marginTop: 10, marginBottom: 8 },
  barFill: { height: 7, borderRadius: 99, backgroundColor: c.primary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontSize: 12, color: c.textSecondary, marginTop: 6 },
  remaining: { fontSize: 12, color: c.textPrimary, fontWeight: '600', marginTop: 6 },
  addBtn: { marginTop: 6, height: 50, borderRadius: 12, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, color: c.primary, fontWeight: '500' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, textAlign: 'center', marginBottom: 4 },
  inputLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16, color: c.textPrimary },
  help: { fontSize: 12, color: c.textMuted, marginTop: 8 },
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
