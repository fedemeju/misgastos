import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { addExpense, getCashArsAccounts } from '../src/db';
import { CATEGORIES } from '../src/categories';
import { today, formatBalance } from '../src/format';
import { useTheme } from '../src/theme';

export default function Manual() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('supermercado');
  const [saving, setSaving] = useState(false);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [accountId, setAccountId] = useState(null); // null = no descontar

  useEffect(() => { getCashArsAccounts().then(setCashAccounts); }, []);

  async function save() {
    const value = parseFloat(String(amount).replace(',', '.'));
    if (!description.trim()) return Alert.alert('Falta la descripción', 'Escribí qué fue el gasto.');
    if (!value || value <= 0) return Alert.alert('Monto inválido', 'Ingresá un monto mayor a 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');

    setSaving(true);
    try {
      await addExpense({ description: description.trim(), amount: value, category, merchant: merchant.trim(), date, source: 'manual', accountId });
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e.message || e));
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Descripción</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Ej: Compra en el súper" placeholderTextColor={c.textFaint} />

        <Text style={styles.label}>Monto</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={c.textFaint} keyboardType="decimal-pad" />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((cItem) => {
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

        <Text style={styles.label}>Comercio (opcional)</Text>
        <TextInput style={styles.input} value={merchant} onChangeText={setMerchant} placeholder="Ej: Coto" placeholderTextColor={c.textFaint} />

        <Text style={styles.label}>Fecha</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={c.textFaint} />

        {cashAccounts.length > 0 && (
          <>
            <Text style={styles.label}>¿Pagaste en efectivo?</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, accountId === null && { backgroundColor: c.selectedBg, borderColor: c.primary }]}
                onPress={() => setAccountId(null)}
              >
                <Text style={[styles.chipText, accountId === null && { color: c.primary, fontWeight: '600' }]}>No descontar</Text>
              </TouchableOpacity>
              {cashAccounts.map((acc) => {
                const active = accountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.chip, active && { backgroundColor: c.selectedBg, borderColor: c.primary }]}
                    onPress={() => setAccountId(acc.id)}
                  >
                    <Text style={[styles.chipText, active && { color: c.primary, fontWeight: '600' }]}>
                      {acc.name} ({formatBalance(acc.balance, acc.currency)})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helpText}>Si elegís una cuenta, el monto se resta de ese efectivo.</Text>
          </>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Guardando…' : 'Guardar gasto'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: c.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipText: { fontSize: 13, color: c.textSecondary },
  helpText: { fontSize: 12, color: c.textMuted, marginTop: 8 },
  saveBtn: { backgroundColor: c.primary, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  saveText: { color: c.onPrimary, fontSize: 16, fontWeight: '600' },
});
