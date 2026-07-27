import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportAllData, importAllData } from './db';

// Exporta todo a un archivo JSON y abre el menú de compartir (Drive, mail, etc.).
export async function exportBackup() {
  const data = await exportAllData();
  const json = JSON.stringify(data);
  const name = `gastos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const uri = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(uri, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Guardar backup de gastos' });
  }
  return name;
}

// Deja elegir un archivo de backup y restaura todo. Devuelve un resumen o null si se canceló.
export async function importBackup() {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled) return null;
  const uri = res.assets[0].uri;
  const json = await FileSystem.readAsStringAsync(uri);
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('El archivo no se pudo leer. ¿Seguro que es un backup?');
  }
  if (!data || !Array.isArray(data.expenses)) {
    throw new Error('El archivo no es un backup válido de la app.');
  }
  await importAllData(data);
  return {
    expenses: data.expenses.length,
    accounts: (data.accounts || []).length,
    debts: (data.debts || []).length,
  };
}
