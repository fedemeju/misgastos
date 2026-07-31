import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import { getTotalsByCategory, getExpenseTotalByMonth, getIncomeTotalByMonth } from '../src/db';
import { getCategory } from '../src/categories';
import { formatMoney, currentMonth, monthLabel } from '../src/format';
import { useTheme } from '../src/theme';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Donut({ data, total, color, textColor, subColor }) {
  const size = 180, stroke = 26, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" opacity={0.12} />
          {data.map((d) => {
            const frac = total ? d.total / total : 0;
            const seg = (
              <Circle
                key={d.category}
                cx={size / 2} cy={size / 2} r={r}
                stroke={getCategory(d.category).color}
                strokeWidth={stroke} fill="none"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-acc * C}
                strokeLinecap="butt"
              />
            );
            acc += frac;
            return seg;
          })}
        </G>
      </Svg>
      <View style={{ position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, color: subColor }}>Total</Text>
        <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
}

export default function Analysis() {
  const params = useLocalSearchParams();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const month = typeof params.month === 'string' ? params.month : currentMonth();
  const prev = shiftMonth(month, -1);
  const [cur, setCur] = useState([]);
  const [prevTot, setPrevTot] = useState([]);
  const [history, setHistory] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getTotalsByCategory(month).then(setCur);
      getTotalsByCategory(prev).then(setPrevTot);
      (async () => {
        const arr = [];
        for (let i = 5; i >= 0; i--) {
          const mm = shiftMonth(month, -i);
          const [ex, inc] = await Promise.all([getExpenseTotalByMonth(mm), getIncomeTotalByMonth(mm)]);
          arr.push({ month: mm, expense: ex, income: inc });
        }
        setHistory(arr);
      })();
    }, [month, prev])
  );

  const maxHist = history.reduce((mx, h) => Math.max(mx, h.expense, h.income), 0);
  const compact = (n) => (n >= 1000000 ? Math.round(n / 100000) / 10 + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : Math.round(n));
  const monthAbbr = (mm) => ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(mm.split('-')[1]) - 1];

  const curTotal = cur.reduce((s, t) => s + t.total, 0);
  const prevTotal = prevTot.reduce((s, t) => s + t.total, 0);
  const diff = curTotal - prevTotal;
  const pct = prevTotal > 0 ? Math.round((diff / prevTotal) * 100) : null;
  const prevMap = useMemo(() => Object.fromEntries(prevTot.map((t) => [t.category, t.total])), [prevTot]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scroll}>
      <Text style={styles.monthLabel}>{monthLabel(month)}</Text>

      <View style={styles.compareCard}>
        <View style={styles.compareRow}>
          <View>
            <Text style={styles.compareLabel}>Este mes</Text>
            <Text style={styles.compareValue}>{formatMoney(curTotal)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.compareLabel}>{monthLabel(prev)}</Text>
            <Text style={styles.comparePrev}>{formatMoney(prevTotal)}</Text>
          </View>
        </View>
        {prevTotal > 0 && (
          <Text style={[styles.deltaText, { color: diff > 0 ? c.danger : c.primary }]}>
            {diff > 0 ? '▲' : '▼'} {formatMoney(Math.abs(diff))} ({pct > 0 ? '+' : ''}{pct}%) vs mes anterior
          </Text>
        )}
      </View>

      <Text style={styles.section}>Evolución (últimos 6 meses)</Text>
      <View style={styles.chartCard}>
        <View style={styles.chart}>
          {history.map((h) => {
            const eH = maxHist ? Math.max(3, (h.expense / maxHist) * 110) : 3;
            const iH = maxHist ? Math.max(3, (h.income / maxHist) * 110) : 3;
            const isCur = h.month === month;
            return (
              <View key={h.month} style={styles.chartCol}>
                <Text style={styles.chartVal}>{h.expense > 0 ? compact(h.expense) : ''}</Text>
                <View style={styles.barsPair}>
                  <View style={[styles.bar, { height: eH, backgroundColor: isCur ? c.danger : c.danger + '77' }]} />
                  <View style={[styles.bar, { height: iH, backgroundColor: isCur ? c.primary : c.primary + '77' }]} />
                </View>
                <Text style={[styles.chartMonth, isCur && { color: c.textPrimary, fontWeight: '600' }]}>{monthAbbr(h.month)}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.legendChart}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: c.danger }]} /><Text style={styles.legendTxt}>Gastos</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: c.primary }]} /><Text style={styles.legendTxt}>Ingresos</Text></View>
        </View>
      </View>

      {cur.length === 0 ? (
        <Text style={styles.empty}>No hay gastos este mes para analizar.</Text>
      ) : (
        <>
          <Text style={styles.section}>Distribución por categoría</Text>
          <View style={styles.donutWrap}>
            <Donut data={cur} total={curTotal} color={c.textPrimary} textColor={c.textPrimary} subColor={c.textMuted} />
          </View>

          {cur.map((t) => {
            const cat = getCategory(t.category);
            const share = curTotal ? Math.round((t.total / curTotal) * 100) : 0;
            const pv = prevMap[t.category] || 0;
            const d = t.total - pv;
            return (
              <View key={t.category} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: cat.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendName}>{cat.label}</Text>
                  <Text style={styles.legendSub}>{share}% del mes{pv > 0 ? ` · ${d >= 0 ? '+' : '−'}${formatMoney(Math.abs(d))} vs mes ant.` : ''}</Text>
                </View>
                <Text style={styles.legendAmount}>{formatMoney(t.total)}</Text>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 32 },
  monthLabel: { fontSize: 13, color: c.textSecondary, textTransform: 'capitalize', marginBottom: 12 },
  compareCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
  compareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  compareLabel: { fontSize: 12, color: c.textMuted },
  compareValue: { fontSize: 26, fontWeight: '600', color: c.textPrimary, marginTop: 2 },
  comparePrev: { fontSize: 16, fontWeight: '500', color: c.textSecondary, marginTop: 2 },
  deltaText: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  section: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginTop: 24, marginBottom: 10 },
  chartCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 6 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartVal: { fontSize: 9, color: c.textMuted, marginBottom: 3 },
  barsPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { width: 9, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  chartMonth: { fontSize: 10, color: c.textSecondary, marginTop: 5 },
  legendChart: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: 12, color: c.textSecondary },
  donutWrap: { alignItems: 'center', marginVertical: 8 },
  empty: { fontSize: 13, color: c.textMuted, marginTop: 20 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 8, marginTop: 2 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  legendName: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  legendSub: { fontSize: 11, color: c.textMuted, marginTop: 2 },
  legendAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
});
