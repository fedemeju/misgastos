import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '../../src/firebase';
import { getSetting, setSetting } from '../../src/db';
import { CATEGORIES, getCategory } from '../../src/categories';
import { formatMoney, shortDate, today } from '../../src/format';
import { useTheme } from '../../src/theme';

export default function Hogar() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [code, setCode] = useState(null);   // código de hogar (compartido)
  const [name, setName] = useState('');      // tu nombre
  const [loadedCfg, setLoadedCfg] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Setup form
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('hogar');
  const [date, setDate] = useState(today());

  useEffect(() => {
    Promise.all([getSetting('household_code'), getSetting('household_name')]).then(([hc, hn]) => {
      setCode(hc || null);
      setName(hn || '');
      setCodeInput(hc || '');
      setNameInput(hn || '');
      setLoadedCfg(true);
    });
  }, []);

  // Suscripción en tiempo real a los gastos del hogar.
  useEffect(() => {
    if (!code || !isFirebaseConfigured()) { setLoading(false); return; }
    const db = getFirestoreDb();
    const q = query(collection(db, 'households', code, 'expenses'), orderBy('date', 'desc'));
    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [code]);

  async function saveSetup() {
    if (!codeInput.trim()) return Alert.alert('Falta el código', 'Poné un código de hogar (el mismo que va a usar tu pareja).');
    if (!nameInput.trim()) return Alert.alert('Falta tu nombre', 'Poné tu nombre para saber quién carga cada gasto.');
    await setSetting('household_code', codeInput.trim());
    await setSetting('household_name', nameInput.trim());
    setName(nameInput.trim());
    setCode(codeInput.trim());
  }

  async function addExpense() {
    const value = parseFloat(String(amount).replace(',', '.'));
    if (!desc.trim()) return Alert.alert('Falta la descripción', 'Escribí qué fue el gasto.');
    if (!value || value <= 0) return Alert.alert('Monto inválido', 'Ingresá un monto mayor a 0.');
    try {
      const db = getFirestoreDb();
      await addDoc(collection(db, 'households', code, 'expenses'), {
        description: desc.trim(), amount: value, category, date, addedBy: name, createdAt: serverTimestamp(),
      });
      setDesc(''); setAmount(''); setCategory('hogar'); setDate(today()); setAddOpen(false);
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e.message || e));
    }
  }

  function confirmDelete(it) {
    Alert.alert('Borrar gasto', `¿Borrar "${it.description}" (${formatMoney(it.amount)})?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deleteDoc(doc(getFirestoreDb(), 'households', code, 'expenses', it.id)).catch(() => {}) },
    ]);
  }

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  // --- Firebase sin configurar ---
  if (!isFirebaseConfigured()) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <Text style={styles.bigIcon}>🏠</Text>
        <Text style={styles.title}>Falta conectar Firebase</Text>
        <Text style={styles.msg}>Esta pestaña sincroniza los gastos con tu pareja por la nube. Cuando me pases los datos de Firebase, queda activa.</Text>
      </SafeAreaView>
    );
  }

  if (!loadedCfg) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  // --- Setup del hogar ---
  if (!code) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Conectar con tu pareja</Text>
          <Text style={styles.msg}>Elegí un código secreto para su hogar. Los dos tienen que poner el MISMO código para ver los mismos gastos.</Text>
          <Text style={styles.label}>Código de hogar</Text>
          <TextInput style={styles.input} value={codeInput} onChangeText={setCodeInput} autoCapitalize="none" placeholder="ej: casa-fede-ana-2026" placeholderTextColor={c.textFaint} />
          <Text style={styles.label}>Tu nombre</Text>
          <TextInput style={styles.input} value={nameInput} onChangeText={setNameInput} placeholder="ej: Fede" placeholderTextColor={c.textFaint} />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveSetup}><Text style={styles.primaryBtnText}>Conectar</Text></TouchableOpacity>
          <Text style={styles.hint}>Pasale el mismo código a tu pareja para que se conecte desde su teléfono.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- Lista compartida ---
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total del hogar</Text>
          <Text style={styles.total}>{formatMoney(total)}</Text>
          <Text style={styles.codeLabel}>Hogar: {code}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay gastos compartidos. Cargá el primero.</Text>
        ) : (
          items.map((it) => {
            const cat = getCategory(it.category);
            return (
              <TouchableOpacity key={it.id} style={styles.row} onLongPress={() => confirmDelete(it)}>
                <View style={styles.rowLeft}>
                  <View style={[styles.catDot, { backgroundColor: cat.color + '22' }]}><Text style={{ fontSize: 15 }}>{cat.icon}</Text></View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.rowDesc}>{it.description}</Text>
                    <Text style={styles.rowMeta}>{cat.label} · {shortDate(it.date)}{it.addedBy ? ` · ${it.addedBy}` : ''}</Text>
                  </View>
                </View>
                <Text style={styles.rowAmount}>{formatMoney(it.amount)}</Text>
              </TouchableOpacity>
            );
          })
        )}
        {items.length > 0 && <Text style={styles.tinyHint}>Mantené presionado un gasto para borrarlo.</Text>}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>＋  Cargar gasto compartido</Text>
        </TouchableOpacity>
      </View>

      {addOpen && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setAddOpen(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Gasto compartido</Text>
              <Text style={styles.label}>Descripción</Text>
              <TextInput style={styles.input} value={desc} onChangeText={setDesc} placeholder="Ej: Supermercado" placeholderTextColor={c.textFaint} />
              <Text style={styles.label}>Monto</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={c.textFaint} />
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((cItem) => {
                  const active = cItem.key === category;
                  return (
                    <TouchableOpacity key={cItem.key} style={[styles.chip, active && { backgroundColor: cItem.color + '22', borderColor: cItem.color }]} onPress={() => setCategory(cItem.key)}>
                      <Text style={[styles.chipText, active && { color: cItem.color, fontWeight: '600' }]}>{cItem.icon} {cItem.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.label}>Fecha</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={c.textFaint} />
              <View style={styles.sheetActions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setAddOpen(false)}><Text style={styles.btnGhostText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={addExpense}><Text style={styles.btnPrimaryText}>Guardar</Text></TouchableOpacity>
              </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  bigIcon: { fontSize: 44, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: c.textPrimary, marginBottom: 8, textAlign: 'center' },
  msg: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: c.textPrimary },
  primaryBtn: { backgroundColor: c.primary, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, color: c.textMuted, marginTop: 16, textAlign: 'center', lineHeight: 17 },
  totalCard: { backgroundColor: c.card, borderRadius: 16, padding: 16 },
  totalLabel: { fontSize: 13, color: c.textSecondary },
  total: { fontSize: 28, fontWeight: '600', color: c.textPrimary, marginTop: 2 },
  codeLabel: { fontSize: 11, color: c.textMuted, marginTop: 6 },
  empty: { fontSize: 13, color: c.textMuted, marginTop: 24, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginTop: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  catDot: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowDesc: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  rowMeta: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  tinyHint: { color: c.textFaint, fontSize: 11, marginTop: 12, textAlign: 'center' },
  actions: { padding: 16, paddingTop: 8 },
  addBtn: { backgroundColor: c.primary, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipText: { fontSize: 13, color: c.textSecondary },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: c.subtle },
  btnGhostText: { fontSize: 15, color: c.textPrimary, fontWeight: '500' },
  btnPrimary: { backgroundColor: c.primary },
  btnPrimaryText: { fontSize: 15, color: c.onPrimary, fontWeight: '600' },
});
