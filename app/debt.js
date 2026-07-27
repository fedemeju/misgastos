import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { getDebt, getDebtPayments, addDebtPayment, deleteDebtPayment, deleteDebt } from '../src/db';
import { formatBalance, shortDate, today } from '../src/format';
import { useTheme } from '../src/theme';

export default function DebtDetail() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [debt, setDebt] = useState(null);
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    getDebt(id).then((d) => { setDebt(d); if (d) navigation.setOptions({ title: d.name }); });
    getDebtPayments(id).then(setPayments);
  }, [id]);
  useFocusEffect(load);

  async function addPayment() {
    const value = parseFloat(String(amount).replace(',', '.'));
    if (!value || value <= 0) return Alert.alert('Monto inválido', 'Ingresá un monto mayor a 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');
    await addDebtPayment({ debtId: id, amount: value, date, note: note.trim() });
    setAmount(''); setNote(''); setDate(today());
    load();
  }

  function confirmDeletePayment(p) {
    Alert.alert('Borrar pago', `¿Borrar el pago de ${formatBalance(p.amount, debt?.currency)} del ${shortDate(p.date)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteDebtPayment(p.id); load(); } },
    ]);
  }

  function confirmDeleteDebt() {
    Alert.alert('Borrar deuda', `¿Borrar "${debt?.name}" y todos sus pagos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteDebt(id); router.back(); } },
    ]);
  }

  if (!debt) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const remaining = debt.total > 0 ? debt.total - debt.paid : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatBalance(debt.paid, debt.currency)}</Text>
            <Text style={styles.statLabel}>Pagado</Text>
          </View>
          {debt.total > 0 && (
            <>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatBalance(debt.total, debt.currency)}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: c.primary }]}>{formatBalance(remaining, debt.currency)}</Text>
                <Text style={styles.statLabel}>Resta</Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.section}>Registrar un pago</Text>
        <View style={styles.form}>
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Monto ({debt.currency === 'USD' ? 'USD' : 'pesos'})</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textFaint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fecha</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={c.textFaint} />
            </View>
          </View>
          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Ej: transferencia" placeholderTextColor={c.textFaint} />
          <TouchableOpacity style={styles.payBtn} onPress={addPayment}><Text style={styles.payBtnText}>Registrar pago</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Historial de pagos</Text>
        {payments.length === 0 ? (
          <Text style={styles.empty}>Todavía no registraste pagos.</Text>
        ) : (
          payments.map((p) => (
            <TouchableOpacity key={p.id} style={styles.payRow} onLongPress={() => confirmDeletePayment(p)}>
              <View>
                <Text style={styles.payAmount}>{formatBalance(p.amount, debt.currency)}</Text>
                <Text style={styles.payMeta}>{shortDate(p.date)}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
              <Text style={styles.payDate}>{p.date}</Text>
            </TouchableOpacity>
          ))
        )}
        {payments.length > 0 && <Text style={styles.tinyHint}>Mantené presionado un pago para borrarlo.</Text>}

        <TouchableOpacity style={styles.deleteDebt} onPress={confirmDeleteDebt}>
          <Text style={styles.deleteDebtText}>Borrar esta deuda</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  summary: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
  statLabel: { fontSize: 11, color: c.textMuted, marginTop: 3 },
  section: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginTop: 24, marginBottom: 10 },
  form: { backgroundColor: c.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.border },
  formRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, height: 46, fontSize: 15, color: c.textPrimary },
  payBtn: { backgroundColor: c.primary, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  payBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  empty: { fontSize: 13, color: c.textMuted },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  payAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  payMeta: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  payDate: { fontSize: 12, color: c.textMuted },
  tinyHint: { color: c.textFaint, fontSize: 11, marginTop: 8, textAlign: 'center' },
  deleteDebt: { marginTop: 28, alignItems: 'center' },
  deleteDebtText: { color: c.danger, fontSize: 14, fontWeight: '500' },
});
