import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  addExpense, updateExpense, getExpense, getCashArsAccounts,
  addIncome, updateIncome, getIncome,
} from '../src/db';
import { CATEGORIES, INCOME_CATEGORIES } from '../src/categories';
import { today, formatBalance, formatAmountInput, parseAmountInput } from '../src/format';
import { useTheme } from '../src/theme';

export default function Manual() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const editId = params.id ? Number(params.id) : null;
  const isEdit = editId != null;

  const [type, setType] = useState(params.type === 'income' ? 'income' : 'expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('supermercado');
  const [saving, setSaving] = useState(false);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [accountId, setAccountId] = useState(null);

  const cats = type === 'income' ? INCOME_CATEGORIES : CATEGORIES;

  useEffect(() => {
    if (!isEdit) getCashArsAccounts().then(setCashAccounts);
  }, [isEdit]);

  useEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Editar' : type === 'income' ? 'Cargar ingreso' : 'Cargar gasto' });
  }, [isEdit, type]);

  // Carga el registro a editar.
  useEffect(() => {
    if (!isEdit) return;
    const loader = params.type === 'income' ? getIncome : getExpense;
    loader(editId).then((r) => {
      if (!r) return;
      setDescription(r.description);
      setAmount(formatAmountInput(String(r.amount).replace('.', ',')));
      setCategory(r.category);
      setDate(r.date);
      if (params.type !== 'income') setMerchant(r.merchant || '');
    });
  }, [isEdit]);

  function switchType(t) {
    setType(t);
    setCategory(t === 'income' ? 'sueldo' : 'supermercado');
  }

  async function save() {
    const value = parseAmountInput(amount);
    if (!description.trim()) return Alert.alert('Falta la descripción', 'Escribí una descripción.');
    if (!value || value <= 0) return Alert.alert('Monto inválido', 'Ingresá un monto mayor a 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');

    setSaving(true);
    try {
      if (type === 'income') {
        const data = { description: description.trim(), amount: value, category, date };
        if (isEdit) await updateIncome(editId, data); else await addIncome(data);
      } else {
        const data = { description: description.trim(), amount: value, category, merchant: merchant.trim(), date };
        if (isEdit) await updateExpense(editId, data);
        else await addExpense({ ...data, source: 'manual', accountId });
      }
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e.message || e));
      setSaving(false);
    }
  }

  const accent = type === 'income' ? '#1D9E75' : c.primary;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!isEdit && (
          <View style={styles.segment}>
            {[['expense', 'Gasto'], ['income', 'Ingreso']].map(([k, label]) => {
              const active = type === k;
              return (
                <TouchableOpacity key={k} style={[styles.segItem, active && { backgroundColor: c.card }]} onPress={() => switchType(k)}>
                  <Text style={[styles.segText, active && { color: accent, fontWeight: '600' }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Descripción</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder={type === 'income' ? 'Ej: Sueldo julio' : 'Ej: Compra en el súper'} placeholderTextColor={c.textFaint} />

        <Text style={styles.label}>Monto</Text>
        <TextInput style={styles.input} value={amount} onChangeText={(t) => setAmount(formatAmountInput(t))} placeholder="0" placeholderTextColor={c.textFaint} keyboardType="decimal-pad" />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chips}>
          {cats.map((cItem) => {
            const active = cItem.key === category;
            return (
              <TouchableOpacity
                key={cItem.key}
                style={[styles.chip, active && { backgroundColor: cItem.color + '22', borderColor: cItem.color }]}
                onPress={() => setCategory(cItem.key)}
              >
                <Text style={[styles.chipText, active && { color: cItem.color, fontWeight: '600' }]}>{cItem.icon} {cItem.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {type === 'expense' && (
          <>
            <Text style={styles.label}>Comercio (opcional)</Text>
            <TextInput style={styles.input} value={merchant} onChangeText={setMerchant} placeholder="Ej: Coto" placeholderTextColor={c.textFaint} />
          </>
        )}

        <Text style={styles.label}>Fecha</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={c.textFaint} />

        {type === 'expense' && !isEdit && cashAccounts.length > 0 && (
          <>
            <Text style={styles.label}>¿Pagaste en efectivo?</Text>
            <View style={styles.chips}>
              <TouchableOpacity style={[styles.chip, accountId === null && { backgroundColor: c.selectedBg, borderColor: c.primary }]} onPress={() => setAccountId(null)}>
                <Text style={[styles.chipText, accountId === null && { color: c.primary, fontWeight: '600' }]}>No descontar</Text>
              </TouchableOpacity>
              {cashAccounts.map((acc) => {
                const active = accountId === acc.id;
                return (
                  <TouchableOpacity key={acc.id} style={[styles.chip, active && { backgroundColor: c.selectedBg, borderColor: c.primary }]} onPress={() => setAccountId(acc.id)}>
                    <Text style={[styles.chipText, active && { color: c.primary, fontWeight: '600' }]}>{acc.name} ({formatBalance(acc.balance, acc.currency)})</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helpText}>Si elegís una cuenta, el monto se resta de ese efectivo.</Text>
          </>
        )}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : type === 'income' ? 'Guardar ingreso' : 'Guardar gasto'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  segment: { flexDirection: 'row', backgroundColor: c.subtle, borderRadius: 12, padding: 4, marginBottom: 8 },
  segItem: { flex: 1, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 15, color: c.textSecondary, fontWeight: '500' },
  label: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: c.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipText: { fontSize: 13, color: c.textSecondary },
  helpText: { fontSize: 12, color: c.textMuted, marginTop: 8 },
  saveBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
