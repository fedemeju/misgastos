import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect, Link, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getExpensesByMonth, getTotalsByCategory, deleteExpense, deleteExpenses, deleteExpensesByMonth, getIncomesByMonth, deleteIncome, getSetting, setSetting } from '../../src/db';
import { getCategory, getIncomeCategory } from '../../src/categories';
import { formatMoney, currentMonth, monthLabel, shortDate } from '../../src/format';
import { useTheme } from '../../src/theme';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Home() {
  const router = useRouter();
  const { colors: c, homeOnly } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [totals, setTotals] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = useCallback(async (m) => {
    const [exp, inc, tot] = await Promise.all([
      getExpensesByMonth(m),
      getIncomesByMonth(m),
      getTotalsByCategory(m),
    ]);
    setExpenses(exp);
    setIncomes(inc);
    setTotals(tot);
  }, []);

  // Al enfocar Inicio: si venimos de guardar un resumen, saltamos a ese mes.
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const jump = await getSetting('pending_jump_month');
      if (active && jump && /^\d{4}-\d{2}$/.test(jump)) {
        await setSetting('pending_jump_month', '');
        setMonth(jump);
        load(jump);
      } else {
        load(month);
      }
    })();
    return () => { active = false; };
  }, [load, month]));

  const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);
  const incomeTotal = incomes.reduce((sum, i) => sum + i.amount, 0);
  const net = incomeTotal - grandTotal;
  const maxCat = totals.length ? totals[0].total : 0;
  const atCurrent = month === currentMonth();

  function changeMonth(delta) {
    exitSelect();
    setMonth((m) => shiftMonth(m, delta));
  }

  function exitSelect() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Selecciona/deselecciona todos los ids de un grupo (resumen).
  function toggleMany(ids) {
    setSelectedIds((prev) => {
      const allIn = ids.every((id) => prev.includes(id));
      return allIn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  }

  // Agrupa los consumos de un mismo resumen en una sola fila.
  const movements = useMemo(() => {
    const map = new Map();
    const out = [];
    for (const e of expenses) {
      if (e.group_id) {
        if (map.has(e.group_id)) {
          const g = map.get(e.group_id);
          g.total += e.amount; g.count += 1; g.ids.push(e.id);
        } else {
          const g = { type: 'group', groupId: e.group_id, label: e.group_label || 'Resumen de tarjeta', date: e.date, total: e.amount, count: 1, ids: [e.id] };
          map.set(e.group_id, g);
          out.push(g);
        }
      } else {
        out.push({ type: 'single', expense: e });
      }
    }
    return out;
  }, [expenses]);

  // Combina gastos (agrupados) e ingresos, ordenados por fecha.
  const feed = useMemo(() => {
    const items = movements.map((m) => ({ ...m, _date: m.type === 'group' ? m.date : m.expense.date }));
    for (const inc of incomes) items.push({ type: 'income', income: inc, _date: inc.date });
    items.sort((a, b) => (a._date < b._date ? 1 : a._date > b._date ? -1 : 0));
    return items;
  }, [movements, incomes]);

  function confirmDeleteIncome(id) {
    Alert.alert('Borrar ingreso', '¿Seguro que querés borrarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteIncome(id); load(month); } },
    ]);
  }

  function confirmDeleteMonth() {
    if (expenses.length === 0) return;
    Alert.alert(
      `Borrar ${monthLabel(month)}`,
      `Se van a borrar los ${expenses.length} gastos de ${monthLabel(month)} (${formatMoney(grandTotal)}). Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: async () => { await deleteExpensesByMonth(month); exitSelect(); load(month); } },
      ]
    );
  }

  function confirmDelete(id) {
    Alert.alert('Borrar gasto', '¿Seguro que querés borrarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteExpense(id); load(month); } },
    ]);
  }

  function confirmDeleteSelected() {
    if (selectedIds.length === 0) return;
    Alert.alert('Borrar gastos', `¿Borrar los ${selectedIds.length} gastos seleccionados?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: async () => { await deleteExpenses(selectedIds); exitSelect(); load(month); } },
    ]);
  }

  if (homeOnly) return <Redirect href="/hogar" />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.headerTop}>
            <View style={styles.monthSwitch}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrow} hitSlop={10}>
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
              <TouchableOpacity onPress={() => !atCurrent && changeMonth(1)} style={styles.arrow} hitSlop={10} disabled={atCurrent}>
                <Text style={[styles.arrowText, atCurrent && { opacity: 0.25 }]}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.headerBtns}>
              {expenses.length > 0 && (
                <TouchableOpacity style={styles.gearBtn} onPress={() => router.push({ pathname: '/analysis', params: { month } })}>
                  <Text style={styles.gear}>📊</Text>
                </TouchableOpacity>
              )}
              {expenses.length > 0 && (
                <TouchableOpacity style={styles.gearBtn} onPress={confirmDeleteMonth}>
                  <Text style={styles.trash}>🗑</Text>
                </TouchableOpacity>
              )}
              <Link href="/settings" asChild>
                <TouchableOpacity style={styles.gearBtn}><Text style={styles.gear}>⚙︎</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
          <Text style={styles.title}>Gastos del mes</Text>
          <Text style={styles.total}>{formatMoney(grandTotal)}</Text>
          <View style={styles.ptRow}>
            <View style={styles.ptItem}>
              <Text style={styles.ptLabel}>Ingresos</Text>
              <Text style={[styles.ptValue, { color: c.primary }]}>{formatMoney(incomeTotal)}</Text>
            </View>
            <View style={styles.ptItem}>
              <Text style={styles.ptLabel}>Balance</Text>
              <Text style={[styles.ptValue, { color: net >= 0 ? c.primary : c.danger }]}>{formatMoney(net)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/accounts')}>
            <Text style={styles.quickText}>💵  Saldos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/debts')}>
            <Text style={styles.quickText}>🧾  Deudas</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.quickBtn, styles.quickWide]} onPress={() => router.push('/vencimientos')}>
          <Text style={styles.quickText}>📅  Vencimientos de tarjeta y deudas</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Por categoría</Text>
        {totals.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No hay gastos en {monthLabel(month)}.</Text>
          </View>
        ) : (
          totals.map((t) => {
            const cat = getCategory(t.category);
            const pct = maxCat ? Math.max(6, Math.round((t.total / maxCat) * 100)) : 0;
            return (
              <TouchableOpacity
                key={t.category}
                style={styles.catRow}
                activeOpacity={0.6}
                onPress={() => router.push({ pathname: '/category', params: { category: t.category, month } })}
              >
                <View style={[styles.catIcon, { backgroundColor: cat.color + '22' }]}>
                  <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.catTop}>
                    <Text style={styles.catName}>{cat.label}</Text>
                    <Text style={styles.catAmount}>{formatMoney(t.total)}  ›</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Movimientos</Text>
          {expenses.length > 0 && (
            <TouchableOpacity onPress={() => (selectMode ? exitSelect() : setSelectMode(true))}>
              <Text style={styles.selectBtn}>{selectMode ? 'Cancelar' : 'Seleccionar'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {feed.length === 0 ? (
          <Text style={styles.hint}>Cargá un gasto o ingreso con los botones de abajo.</Text>
        ) : (
          feed.map((m) => {
            if (m.type === 'income') {
              const inc = m.income;
              const icat = getIncomeCategory(inc.category);
              return (
                <TouchableOpacity
                  key={'inc' + inc.id}
                  style={styles.moveRow}
                  activeOpacity={0.7}
                  onPress={() => { if (!selectMode) router.push({ pathname: '/manual', params: { id: inc.id, type: 'income' } }); }}
                  onLongPress={() => { if (!selectMode) confirmDeleteIncome(inc.id); }}
                >
                  <View style={styles.moveLeft}>
                    <View>
                      <Text style={styles.moveDesc}>{inc.description}</Text>
                      <Text style={styles.moveMeta}>Ingreso · {icat.label} · {shortDate(inc.date)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.moveAmount, { color: c.primary }]}>+{formatMoney(inc.amount)}</Text>
                </TouchableOpacity>
              );
            }
            if (m.type === 'group') {
              const selected = m.ids.every((id) => selectedIds.includes(id));
              return (
                <TouchableOpacity
                  key={m.groupId}
                  style={[styles.moveRow, selected && styles.moveRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => (selectMode ? toggleMany(m.ids) : router.push({ pathname: '/statement', params: { group: m.groupId } }))}
                  onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleMany(m.ids); } }}
                >
                  <View style={styles.moveLeft}>
                    {selectMode && (
                      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                        {selected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    )}
                    <View>
                      <Text style={styles.moveDesc}>💳 {m.label}</Text>
                      <Text style={styles.moveMeta}>{m.count} consumo{m.count !== 1 ? 's' : ''} · {shortDate(m.date)} · tocá para ver</Text>
                    </View>
                  </View>
                  <Text style={styles.moveAmount}>{formatMoney(m.total)}</Text>
                </TouchableOpacity>
              );
            }
            const e = m.expense;
            const cat = getCategory(e.category);
            const selected = selectedIds.includes(e.id);
            return (
              <TouchableOpacity
                key={e.id}
                style={[styles.moveRow, selected && styles.moveRowSelected]}
                activeOpacity={0.7}
                onPress={() => (selectMode ? toggleSelect(e.id) : router.push({ pathname: '/manual', params: { id: e.id } }))}
                onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSelect(e.id); } }}
              >
                <View style={styles.moveLeft}>
                  {selectMode && (
                    <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  )}
                  <View>
                    <Text style={styles.moveDesc}>{e.description}</Text>
                    <Text style={styles.moveMeta}>
                      {cat.label}{e.merchant ? ` · ${e.merchant}` : ''} · {shortDate(e.date)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.moveAmount}>{formatMoney(e.amount)}</Text>
              </TouchableOpacity>
            );
          })
        )}
        {feed.length > 0 && !selectMode && (
          <Text style={styles.tinyHint}>Tocá un movimiento para editarlo · mantené presionado para borrar.</Text>
        )}
      </ScrollView>

      {selectMode ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger, selectedIds.length === 0 && { opacity: 0.4 }]}
            onPress={confirmDeleteSelected}
            disabled={selectedIds.length === 0}
          >
            <Text style={styles.btnDangerText}>🗑  Borrar {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => router.push('/manual')}>
            <Text style={styles.btnSecondaryText}>✎  Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => router.push('/scan')}>
            <Text style={styles.btnPrimaryText}>📷  Escanear</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthSwitch: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 24, color: c.primary, lineHeight: 26 },
  monthLabel: { fontSize: 14, color: c.textPrimary, fontWeight: '500', textTransform: 'capitalize', minWidth: 120, textAlign: 'center' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  gearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.subtle, alignItems: 'center', justifyContent: 'center' },
  gear: { fontSize: 18, color: c.primary },
  trash: { fontSize: 16 },
  title: { fontSize: 13, color: c.textSecondary, marginTop: 14 },
  total: { fontSize: 30, fontWeight: '600', color: c.textPrimary, marginTop: 2 },
  ptRow: { flexDirection: 'row', gap: 12, marginTop: 14, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  ptItem: { flex: 1 },
  ptLabel: { fontSize: 12, color: c.textMuted },
  ptValue: { fontSize: 18, fontWeight: '600', marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  quickBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  quickWide: { marginTop: 12, flex: undefined },
  quickText: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  section: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginTop: 22, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  selectBtn: { fontSize: 14, color: c.primary, fontWeight: '500' },
  emptyBox: { backgroundColor: c.card, borderRadius: 12, padding: 18, alignItems: 'center' },
  emptyText: { color: c.textMuted, fontSize: 13 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  catIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  catName: { fontSize: 14, color: c.textPrimary },
  catAmount: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
  barBg: { height: 7, backgroundColor: c.barBg, borderRadius: 99 },
  barFill: { height: 7, borderRadius: 99 },
  hint: { color: c.textMuted, fontSize: 13 },
  tinyHint: { color: c.textFaint, fontSize: 11, marginTop: 10, textAlign: 'center' },
  moveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  moveRowSelected: { borderColor: c.primary, backgroundColor: c.selectedBg },
  moveLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.textFaint, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: c.primary, borderColor: c.primary },
  checkmark: { color: c.onPrimary, fontSize: 13, fontWeight: '700' },
  moveDesc: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  moveMeta: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  moveAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  actions: { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 8 },
  btn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  btnSecondaryText: { fontSize: 15, color: c.textPrimary, fontWeight: '500' },
  btnPrimary: { backgroundColor: c.primary },
  btnPrimaryText: { fontSize: 15, color: c.onPrimary, fontWeight: '600' },
  btnDanger: { backgroundColor: c.danger },
  btnDangerText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
