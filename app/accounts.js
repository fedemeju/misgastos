import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  getAccounts, addAccount, deleteAccount, renameAccount, adjustAccountBalance, setAccountBalance, getSetting,
} from '../src/db';
import { formatBalance } from '../src/format';
import { fetchCryptoPricesUsd, fetchDolarOficial } from '../src/prices';
import { useTheme } from '../src/theme';

const KIND_ICON = { cash: '💵', crypto: '🪙' };
const NEW_TYPES = [
  { label: 'Pesos', kind: 'cash', currency: 'ARS' },
  { label: 'Dólares', kind: 'cash', currency: 'USD' },
  { label: 'Cripto', kind: 'crypto', currency: 'BTC' },
];

export default function Accounts() {
  const { colors: c } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [unlocked, setUnlocked] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [prices, setPrices] = useState({}); // { BTC: 65000, ... } en USD
  const [dolar, setDolar] = useState(null); // { compra, venta } oficial

  // Modal de acción sobre una cuenta.
  const [sel, setSel] = useState(null);      // cuenta seleccionada
  const [mode, setMode] = useState('menu');  // menu | ingresar | retirar | ajustar | renombrar
  const [value, setValue] = useState('');

  // Modal de nueva cuenta.
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(NEW_TYPES[0]);
  const [newSymbol, setNewSymbol] = useState('BTC');

  const load = useCallback(() => {
    getAccounts().then(async (accs) => {
      setAccounts(accs);
      // Cualquier moneda que no sea pesos/dólares se considera cripto y se cotiza.
      const coinSyms = accs.map((a) => a.currency).filter((cur) => cur && cur !== 'ARS' && cur !== 'USD');
      const symbols = [...new Set(['BTC', 'ETH', ...coinSyms])];
      setPrices(await fetchCryptoPricesUsd(symbols));
    });
    fetchDolarOficial().then(setDolar);
  }, []);

  // Autenticación por huella/rostro. Si el usuario la tiene activada y el
  // dispositivo la soporta, hay que desbloquear para ver los saldos.
  const authenticate = useCallback(async () => {
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHw || !enrolled) return true; // sin biometría configurada -> se permite
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloqueá tus saldos',
      cancelLabel: 'Cancelar',
    });
    return res.success;
  }, []);

  const tryUnlock = useCallback(async () => {
    const lockOn = (await getSetting('lock_accounts')) !== 'off'; // por defecto activada
    if (!lockOn) { setUnlocked(true); load(); return; }
    const ok = await authenticate();
    if (ok) { setUnlocked(true); load(); }
    else setUnlocked(false);
  }, [authenticate, load]);

  useFocusEffect(
    useCallback(() => {
      tryUnlock();
      return () => setUnlocked(false); // al salir, vuelve a bloquear
    }, [tryUnlock])
  );

  // ¿La cuenta es en cripto? (cualquier moneda que no sea pesos ni dólares)
  function isCrypto(acc) {
    const cur = (acc.currency || '').toUpperCase();
    return cur && cur !== 'ARS' && cur !== 'USD';
  }

  // Valor en USD de una cuenta cripto (o null si no hay cotización).
  function usdValue(acc) {
    if (!isCrypto(acc)) return null;
    const p = prices[(acc.currency || '').toUpperCase()];
    return p != null ? acc.balance * p : null;
  }

  // Total en dólares: cuentas en USD + cripto valuada en USD.
  const usdTotal = accounts.reduce((sum, acc) => {
    if (acc.currency === 'USD') return sum + acc.balance;
    const v = usdValue(acc);
    return v != null ? sum + v : sum;
  }, 0);
  const hasUsd = accounts.some((a) => a.currency && a.currency !== 'ARS');

  function openAccount(acc) {
    setSel(acc);
    setMode('menu');
    setValue('');
  }
  function closeSheet() { setSel(null); setMode('menu'); setValue(''); }

  function num(v) { return parseFloat(String(v).replace(',', '.')); }

  async function applyAction() {
    const acc = sel;
    if (!acc) return;
    if (mode === 'renombrar') {
      if (!value.trim()) return;
      await renameAccount(acc.id, value.trim());
    } else {
      const n = num(value);
      if (!Number.isFinite(n)) return Alert.alert('Valor inválido', 'Ingresá un número.');
      if (mode === 'ingresar') await adjustAccountBalance(acc.id, Math.abs(n));
      else if (mode === 'retirar') await adjustAccountBalance(acc.id, -Math.abs(n));
      else if (mode === 'ajustar') await setAccountBalance(acc.id, n);
    }
    closeSheet();
    load();
  }

  function confirmDelete(acc) {
    Alert.alert('Borrar cuenta', `¿Borrar "${acc.name}"? El saldo registrado se pierde.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteAccount(acc.id); closeSheet(); load(); } },
    ]);
  }

  async function createAccount() {
    if (!newName.trim()) return Alert.alert('Falta el nombre', 'Poné un nombre a la cuenta.');
    const currency = newType.kind === 'crypto' ? (newSymbol.trim().toUpperCase() || 'BTC') : newType.currency;
    await addAccount({ name: newName.trim(), kind: newType.kind, currency });
    setAddOpen(false);
    setNewName('');
    setNewType(NEW_TYPES[0]);
    setNewSymbol('BTC');
    load();
  }

  if (!unlocked) {
    return (
      <View style={styles.lockWrap}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Saldos protegidos</Text>
        <Text style={styles.lockText}>Usá tu huella o rostro para ver tus saldos.</Text>
        <TouchableOpacity style={styles.lockBtn} onPress={tryUnlock}>
          <Text style={styles.lockBtnText}>Desbloquear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.lockBack} onPress={() => router.back()}>
          <Text style={styles.lockBackText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {hasUsd && (
          <View style={styles.usdCard}>
            <Text style={styles.usdLabel}>Total en dólares</Text>
            <Text style={styles.usdValue}>{formatBalance(usdTotal, 'USD')}</Text>
            {dolar?.venta ? (
              <Text style={styles.usdNote}>≈ {formatBalance(usdTotal * dolar.venta, 'ARS')} al dólar oficial</Text>
            ) : (
              <Text style={styles.usdNote}>Cuentas en USD + cripto a cotización de hoy</Text>
            )}
          </View>
        )}

        <Text style={styles.intro}>Tus saldos de efectivo y cripto. Tocá una cuenta para ingresar, retirar o ajustar.</Text>

        {accounts.map((acc) => {
          const usd = usdValue(acc);
          return (
            <TouchableOpacity key={acc.id} style={styles.accRow} activeOpacity={0.7} onPress={() => openAccount(acc)}>
              <View style={styles.accLeft}>
                <Text style={styles.accIcon}>{KIND_ICON[acc.kind] || '💰'}</Text>
                <View>
                  <Text style={styles.accName}>{acc.name}</Text>
                  <Text style={styles.accCurrency}>{acc.currency}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.accBalance}>{formatBalance(acc.balance, acc.currency)}</Text>
                {usd != null ? (
                  <Text style={styles.accUsd}>≈ {formatBalance(usd, 'USD')}</Text>
                ) : isCrypto(acc) ? (
                  <Text style={styles.accUsd}>sin cotización</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>+  Agregar cuenta</Text>
        </TouchableOpacity>

        <View style={[styles.quotesCard, { marginTop: 20, marginBottom: 0 }]}>
          <Text style={styles.quotesTitle}>Cotizaciones de hoy</Text>
          <View style={styles.quotesRow}>
            <Text style={styles.quoteLabel}>💵 Dólar oficial</Text>
            <Text style={styles.quoteVal}>{dolar?.venta ? formatBalance(dolar.venta, 'ARS') : '—'}</Text>
          </View>
          <View style={styles.quotesRow}>
            <Text style={styles.quoteLabel}>₿ Bitcoin</Text>
            <Text style={styles.quoteVal}>{prices.BTC ? formatBalance(prices.BTC, 'USD') : '—'}</Text>
          </View>
          <View style={[styles.quotesRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.quoteLabel}>Ξ Ethereum</Text>
            <Text style={styles.quoteVal}>{prices.ETH ? formatBalance(prices.ETH, 'USD') : '—'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Acciones sobre una cuenta */}
      {sel !== null && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior="padding">
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={closeSheet}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{sel?.name}</Text>
              <Text style={styles.sheetBalance}>{sel && formatBalance(sel.balance, sel.currency)}</Text>

              {mode === 'menu' ? (
                <>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => setMode('ingresar')}><Text style={styles.menuBtnText}>➕  Ingresar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => setMode('retirar')}><Text style={styles.menuBtnText}>➖  Retirar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => { setMode('ajustar'); setValue(String(sel.balance)); }}><Text style={styles.menuBtnText}>✎  Corregir saldo</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => { setMode('renombrar'); setValue(sel.name); }}><Text style={styles.menuBtnText}>🏷  Renombrar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => confirmDelete(sel)}><Text style={[styles.menuBtnText, { color: c.danger }]}>🗑  Borrar cuenta</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>
                    {mode === 'ingresar' ? 'Cuánto ingresás' : mode === 'retirar' ? 'Cuánto retirás' : mode === 'ajustar' ? 'Saldo real' : 'Nuevo nombre'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={setValue}
                    autoFocus
                    keyboardType={mode === 'renombrar' ? 'default' : 'decimal-pad'}
                    placeholder={mode === 'renombrar' ? 'Nombre' : '0'}
                    placeholderTextColor={c.textFaint}
                  />
                  <View style={styles.sheetActions}>
                    <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => { setMode('menu'); setValue(''); }}>
                      <Text style={styles.btnGhostText}>Volver</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={applyAction}>
                      <Text style={styles.btnPrimaryText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}

      {/* Nueva cuenta */}
      {addOpen && (
        <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior="padding">
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setAddOpen(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>Nueva cuenta</Text>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="Ej: Efectivo mochila" placeholderTextColor={c.textFaint} />
              <Text style={styles.inputLabel}>Tipo</Text>
              <View style={styles.typeChips}>
                {NEW_TYPES.map((t) => {
                  const active = t.label === newType.label;
                  return (
                    <TouchableOpacity key={t.label} style={[styles.typeChip, active && styles.typeChipActive]} onPress={() => setNewType(t)}>
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newType.kind === 'crypto' && (
                <>
                  <Text style={styles.inputLabel}>Símbolo</Text>
                  <TextInput style={styles.input} value={newSymbol} onChangeText={setNewSymbol} autoCapitalize="characters" placeholder="BTC, ETH, USDT…" placeholderTextColor={c.textFaint} />
                </>
              )}
              <View style={styles.sheetActions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setAddOpen(false)}>
                  <Text style={styles.btnGhostText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={createAccount}>
                  <Text style={styles.btnPrimaryText}>Crear</Text>
                </TouchableOpacity>
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
  lockWrap: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockIcon: { fontSize: 48, marginBottom: 16 },
  lockTitle: { fontSize: 18, fontWeight: '600', color: c.textPrimary, marginBottom: 8 },
  lockText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  lockBtn: { backgroundColor: c.primary, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  lockBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '600' },
  lockBack: { marginTop: 16, padding: 8 },
  lockBackText: { color: c.textSecondary, fontSize: 14 },
  quotesCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  quotesTitle: { fontSize: 13, color: c.textSecondary, fontWeight: '600', marginBottom: 8 },
  quotesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border },
  quoteLabel: { fontSize: 14, color: c.textPrimary },
  quoteVal: { fontSize: 14, color: c.textPrimary, fontWeight: '600' },
  usdCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  usdLabel: { fontSize: 13, color: c.textSecondary },
  usdValue: { fontSize: 26, fontWeight: '600', color: c.primary, marginTop: 2 },
  usdNote: { fontSize: 11, color: c.textMuted, marginTop: 4 },
  accUsd: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  intro: { fontSize: 13, color: c.textSecondary, marginBottom: 16, lineHeight: 18 },
  accRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  accLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accIcon: { fontSize: 22 },
  accName: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
  accCurrency: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  accBalance: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
  addBtn: { marginTop: 6, height: 50, borderRadius: 12, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, color: c.primary, fontWeight: '500' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, textAlign: 'center' },
  sheetBalance: { fontSize: 22, fontWeight: '600', color: c.primary, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  menuBtn: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border },
  menuBtnText: { fontSize: 15, color: c.textPrimary },
  inputLabel: { fontSize: 13, color: c.textSecondary, fontWeight: '500', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16, color: c.textPrimary },
  typeChips: { flexDirection: 'row', gap: 8 },
  typeChip: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  typeChipActive: { backgroundColor: c.selectedBg, borderColor: c.primary },
  typeChipText: { fontSize: 14, color: c.textSecondary },
  typeChipTextActive: { color: c.primary, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: c.subtle },
  btnGhostText: { fontSize: 15, color: c.textPrimary, fontWeight: '500' },
  btnPrimary: { backgroundColor: c.primary },
  btnPrimaryText: { fontSize: 15, color: c.onPrimary, fontWeight: '600' },
});
