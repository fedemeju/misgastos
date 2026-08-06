import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { extractExpenses } from '../src/extract';
import { addExpensesBatch, setSetting } from '../src/db';
import { CATEGORIES, getCategory } from '../src/categories';
import { formatMoney, shortDate, monthLabel } from '../src/format';
import { useTheme } from '../src/theme';

export default function Scan() {
  const router = useRouter();
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState(null);
  const [docTotal, setDocTotal] = useState(null);
  const [dueDate, setDueDate] = useState(null);
  const [cardName, setCardName] = useState(null);
  const [fileName, setFileName] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);

  async function run(uri, mime, name) {
    setLoading(true);
    setFileName(name || '');
    try {
      const { items: result, documentTotal, dueDate: due, cardName: card } = await extractExpenses(uri, mime);
      if (!result || result.length === 0) {
        Alert.alert('Sin gastos', 'No se detectaron gastos en el comprobante. Probá con otra foto más nítida.');
        setItems(null);
      } else {
        setItems(due ? result.map((it) => ({ ...it, date: due })) : result);
        setDocTotal(documentTotal);
        setDueDate(due);
        setCardName(card);
      }
    } catch (e) {
      Alert.alert('No se pudo leer', String(e.message || e));
      setItems(null);
    } finally {
      setLoading(false);
    }
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso denegado', 'Necesito acceso a tus fotos.');
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled) {
      const a = res.assets[0];
      run(a.uri, a.mimeType, a.fileName || 'foto.jpg');
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso denegado', 'Necesito acceso a la cámara.');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) {
      const a = res.assets[0];
      run(a.uri, a.mimeType, 'foto.jpg');
    }
  }

  async function pickPdf() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!res.canceled) {
      const a = res.assets[0];
      run(a.uri, a.mimeType, a.name);
    }
  }

  function setCategoryFor(index, key) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, category: key } : it)));
    setEditingIndex(null);
  }

  async function saveAll() {
    try {
      // Si es un resumen (tiene vencimiento o nombre de tarjeta), se agrupa como un solo movimiento.
      const isStatement = !!dueDate || !!cardName;
      if (isStatement) {
        const groupId = `stmt_${Date.now()}`;
        const groupLabel = cardName || 'Resumen de tarjeta';
        await addExpensesBatch(items, groupId, groupLabel);
      } else {
        await addExpensesBatch(items);
      }
      // Dejamos anotado el mes donde quedaron guardados para que Inicio salte ahí.
      const targetMonth = String(dueDate || items[0]?.date || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(targetMonth)) await setSetting('pending_jump_month', targetMonth);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', String(e.message || e));
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={styles.loadingText}>Leyendo el comprobante…</Text>
        <Text style={styles.loadingSub}>Detectando y clasificando los gastos</Text>
      </View>
    );
  }

  if (items) {
    const total = items.reduce((s, it) => s + it.amount, 0);
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.fileBanner}>
            <Text style={styles.fileBannerText}>✓  {fileName || 'Comprobante'} · {items.length} gasto{items.length !== 1 ? 's' : ''} detectado{items.length !== 1 ? 's' : ''}</Text>
          </View>
          {dueDate && (
            <View style={styles.dueBanner}>
              <Text style={styles.dueBannerText}>💳 Resumen de tarjeta · vence {shortDate(dueDate)}</Text>
              <Text style={styles.dueBannerSub}>Todos los consumos se guardan en {monthLabel(dueDate.slice(0, 7))}, porque se pagan juntos al vencimiento.</Text>
            </View>
          )}
          <Text style={styles.reviewHint}>Revisá que esté bien y tocá la categoría para cambiarla.</Text>

          {items.map((it, i) => {
            const cat = getCategory(it.category);
            return (
              <View key={i} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.cardDesc}>{it.description}</Text>
                    <Text style={styles.cardMeta}>{shortDate(it.date)}{it.merchant ? ` · ${it.merchant}` : ''}</Text>
                  </View>
                  <Text style={styles.cardAmount}>{formatMoney(it.amount)}</Text>
                </View>
                <TouchableOpacity style={[styles.catPill, { backgroundColor: cat.color + '22' }]} onPress={() => setEditingIndex(i)}>
                  <Text style={[styles.catPillText, { color: cat.color }]}>{cat.icon} {cat.label}  ▾</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Suma de los consumos</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>
          {docTotal != null && (
            <View style={styles.docTotalBox}>
              <View style={styles.totalRow}>
                <Text style={styles.docTotalLabel}>Total del resumen</Text>
                <Text style={styles.docTotalValue}>{formatMoney(docTotal)}</Text>
              </View>
              <Text style={styles.docTotalNote}>
                {Math.abs(docTotal - total) < 1
                  ? '✓ La suma de los consumos coincide con el total.'
                  : `✓ Se leyeron ${items.length} consumos. La diferencia (${formatMoney(docTotal - total)}) es saldo anterior, impuestos y percepciones, que no se cargan como gastos.`}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setItems(null)}>
            <Text style={styles.btnSecondaryText}>Descartar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, { flex: 1.4 }]} onPress={saveAll}>
            <Text style={styles.btnPrimaryText}>✓  Guardar {items.length} gasto{items.length !== 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={editingIndex !== null} transparent animationType="fade" onRequestClose={() => setEditingIndex(null)}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setEditingIndex(null)}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>Elegí la categoría</Text>
              {CATEGORIES.map((cItem) => (
                <TouchableOpacity key={cItem.key} style={styles.sheetRow} onPress={() => setCategoryFor(editingIndex, cItem.key)}>
                  <Text style={styles.sheetIcon}>{cItem.icon}</Text>
                  <Text style={styles.sheetLabel}>{cItem.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.introWrap}>
      <Text style={styles.introTitle}>Sacá una foto del ticket o adjuntá un PDF</Text>
      <Text style={styles.introText}>La app va a leer el comprobante, detectar los gastos y clasificarlos por categoría. Después los confirmás vos.</Text>

      <TouchableOpacity style={styles.sourceBtn} onPress={takePhoto}>
        <Text style={styles.sourceIcon}>📷</Text>
        <View><Text style={styles.sourceTitle}>Sacar foto</Text><Text style={styles.sourceSub}>Con la cámara</Text></View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sourceBtn} onPress={pickPhoto}>
        <Text style={styles.sourceIcon}>🖼️</Text>
        <View><Text style={styles.sourceTitle}>Elegir de la galería</Text><Text style={styles.sourceSub}>Una foto guardada</Text></View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sourceBtn} onPress={pickPdf}>
        <Text style={styles.sourceIcon}>📄</Text>
        <View><Text style={styles.sourceTitle}>Adjuntar PDF o imagen</Text><Text style={styles.sourceSub}>Factura o resumen</Text></View>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  scroll: { padding: 16 },
  introWrap: { flex: 1, backgroundColor: c.bg, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.bg },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500', color: c.textPrimary },
  loadingSub: { marginTop: 4, fontSize: 13, color: c.textMuted },

  introTitle: { fontSize: 18, fontWeight: '600', color: c.textPrimary, marginTop: 8 },
  introText: { fontSize: 14, color: c.textSecondary, marginTop: 8, marginBottom: 20, lineHeight: 20 },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  sourceIcon: { fontSize: 24 },
  sourceTitle: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
  sourceSub: { fontSize: 12, color: c.textMuted, marginTop: 2 },

  fileBanner: { backgroundColor: c.banner, borderRadius: 12, padding: 12, marginBottom: 12 },
  fileBannerText: { color: c.bannerText, fontSize: 13, fontWeight: '500' },
  dueBanner: { backgroundColor: c.neutralBanner, borderRadius: 12, padding: 12, marginBottom: 12 },
  dueBannerText: { color: c.textPrimary, fontSize: 13, fontWeight: '600' },
  dueBannerSub: { color: c.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  reviewHint: { fontSize: 12, color: c.textMuted, marginBottom: 12 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDesc: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
  cardMeta: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  cardAmount: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  catPill: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99 },
  catPillText: { fontSize: 12, fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  totalLabel: { fontSize: 15, color: c.textSecondary, fontWeight: '500' },
  totalValue: { fontSize: 17, color: c.textPrimary, fontWeight: '600' },
  docTotalBox: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14, marginTop: 12 },
  docTotalLabel: { fontSize: 15, color: c.textPrimary, fontWeight: '600' },
  docTotalValue: { fontSize: 17, color: c.primary, fontWeight: '600' },
  docTotalNote: { fontSize: 12, color: c.textMuted, marginTop: 8, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 8 },
  btn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  btnSecondaryText: { fontSize: 15, color: c.textPrimary, fontWeight: '500' },
  btnPrimary: { backgroundColor: c.primary },
  btnPrimaryText: { fontSize: 15, color: c.onPrimary, fontWeight: '600' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: c.textPrimary, marginBottom: 8, textAlign: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  sheetIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  sheetLabel: { fontSize: 15, color: c.textPrimary },
});
