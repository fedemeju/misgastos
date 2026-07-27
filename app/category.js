import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { getExpensesByCategoryMonth } from '../src/db';
import { getCategory } from '../src/categories';
import { formatMoney, monthLabel, shortDate } from '../src/format';
import { useTheme } from '../src/theme';

export default function CategoryDetail() {
  const { category, month } = useLocalSearchParams();
  const navigation = useNavigation();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState([]);
  const cat = getCategory(category);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: cat.label });
      getExpensesByCategoryMonth(category, month).then(setItems);
    }, [category, month])
  );

  const total = items.reduce((s, e) => s + e.amount, 0);
  const count = items.length;
  const avg = count ? total / count : 0;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: cat.color + '22' }]}>
          <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
        </View>
        <View>
          <Text style={styles.catLabel}>{cat.label}</Text>
          <Text style={styles.monthLabel}>{monthLabel(String(month))}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(total)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{count}</Text>
          <Text style={styles.statLabel}>Gastos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatMoney(avg)}</Text>
          <Text style={styles.statLabel}>Promedio</Text>
        </View>
      </View>

      <Text style={styles.section}>Detalle</Text>
      {items.length === 0 ? (
        <Text style={styles.hint}>No hay gastos de esta categoría en el mes.</Text>
      ) : (
        items.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.desc}>{e.description}</Text>
              <Text style={styles.meta}>{e.merchant ? `${e.merchant} · ` : ''}{shortDate(e.date)}</Text>
            </View>
            <Text style={styles.amount}>{formatMoney(e.amount)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 20, fontWeight: '600', color: c.textPrimary },
  monthLabel: { fontSize: 13, color: c.textSecondary, textTransform: 'capitalize', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
  statLabel: { fontSize: 11, color: c.textMuted, marginTop: 3 },
  section: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginTop: 22, marginBottom: 10 },
  hint: { color: c.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8 },
  desc: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  meta: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
});
