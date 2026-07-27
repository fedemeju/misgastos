import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { getExpensesByGroup } from '../src/db';
import { getCategory } from '../src/categories';
import { formatMoney, shortDate } from '../src/format';
import { useTheme } from '../src/theme';

export default function Statement() {
  const { group } = useLocalSearchParams();
  const navigation = useNavigation();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getExpensesByGroup(group).then((rows) => {
        setItems(rows);
        if (rows[0]?.group_label) navigation.setOptions({ title: rows[0].group_label });
      });
    }, [group])
  );

  const total = items.reduce((s, e) => s + e.amount, 0);

  // Subtotales por categoría dentro del resumen.
  const byCat = useMemo(() => {
    const map = new Map();
    for (const e of items) map.set(e.category, (map.get(e.category) || 0) + e.amount);
    return [...map.entries()].map(([k, v]) => ({ category: k, total: v })).sort((a, b) => b.total - a.total);
  }, [items]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scroll}>
      <View style={styles.summary}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(total)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Consumos</Text>
        </View>
      </View>

      {byCat.length > 0 && (
        <>
          <Text style={styles.section}>Por categoría</Text>
          {byCat.map((t) => {
            const cat = getCategory(t.category);
            return (
              <View key={t.category} style={styles.catRow}>
                <Text style={styles.catName}>{cat.icon}  {cat.label}</Text>
                <Text style={styles.catAmount}>{formatMoney(t.total)}</Text>
              </View>
            );
          })}
        </>
      )}

      <Text style={styles.section}>Consumos</Text>
      {items.map((e) => {
        const cat = getCategory(e.category);
        return (
          <View key={e.id} style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.desc}>{e.description}</Text>
              <Text style={styles.meta}>{cat.label}{e.merchant ? ` · ${e.merchant}` : ''} · {shortDate(e.date)}</Text>
            </View>
            <Text style={styles.amount}>{formatMoney(e.amount)}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  summary: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '600', color: c.textPrimary },
  statLabel: { fontSize: 11, color: c.textMuted, marginTop: 3 },
  section: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginTop: 22, marginBottom: 10 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  catName: { fontSize: 14, color: c.textPrimary },
  catAmount: { fontSize: 14, color: c.textSecondary, fontWeight: '500' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  desc: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  meta: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
});
