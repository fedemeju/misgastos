import * as Notifications from 'expo-notifications';
import { getSetting, setSetting, getDueReminders, setDueReminderNotif } from './db';
import { formatMoney } from './format';

const DEFAULT_MSG = 'No te olvides de cargar tus gastos e ingresos de hoy 💸';

async function ensurePermission() {
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  return granted;
}

async function cancelById(id) {
  if (!id) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
}

// ---- Recordatorio diario ----

// Programa (o reprograma) el recordatorio diario. Cancela solo el suyo, no los vencimientos.
export async function scheduleDailyReminder(hour, minute, message) {
  if (!(await ensurePermission())) return false;
  await cancelById(await getSetting('reminder_notif_id'));
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Mis Gastos', body: message || DEFAULT_MSG },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  await setSetting('reminder_notif_id', id);
  return true;
}

export async function cancelReminder() {
  await cancelById(await getSetting('reminder_notif_id'));
  await setSetting('reminder_notif_id', '');
}

// Aplica el recordatorio según lo guardado en settings (se llama al iniciar la app).
export async function applyReminderFromSettings() {
  try {
    const on = (await getSetting('reminder_on')) === 'on';
    if (!on) { await cancelReminder(); return; }
    const time = (await getSetting('reminder_time')) || '21:00';
    const msg = (await getSetting('reminder_msg')) || DEFAULT_MSG;
    const [h, m] = time.split(':').map((n) => Number(n));
    await scheduleDailyReminder(Number.isFinite(h) ? h : 21, Number.isFinite(m) ? m : 0, msg);
  } catch {
    // si no hay soporte de notificaciones (ej. Expo Go), se ignora
  }
}

// ---- Recordatorios: vencimientos, cierres de tarjeta y gastos mensuales ----

const DUE_TITLES = {
  cierre: '💳 Cierre de tarjeta',
  gasto: '💰 Gasto mensual',
  vencimiento: '📅 Vencimiento',
};
function dueTitle(item) {
  return DUE_TITLES[item.category] || DUE_TITLES.vencimiento;
}
function leadOf(item) {
  return Math.max(0, Number(item.lead_days ?? item.leadDays ?? 0));
}
function dueBody(item) {
  const amt = item.amount ? ` · ${formatMoney(item.amount)}` : '';
  const lead = leadOf(item);
  const when = lead === 0 ? 'Hoy' : lead === 1 ? 'Mañana' : `En ${lead} días`;
  if (item.category === 'cierre') return `${when} cierra ${item.title}${amt}`;
  if (item.category === 'gasto') return `${when === 'Hoy' ? 'Pagá hoy' : when + ' pagás'} ${item.title}${amt}`;
  return `${when} vence ${item.title}${amt}`;
}

// Programa una notificación de vencimiento. Devuelve el id o null (si no hay permiso o ya pasó).
export async function scheduleDueNotification(item) {
  if (!(await ensurePermission())) return null;
  const hour = Number.isFinite(item.hour) ? item.hour : 9;
  const minute = Number.isFinite(item.minute) ? item.minute : 0;
  const lead = leadOf(item);
  let trigger;
  if (item.kind === 'once') {
    const d = new Date(`${item.date}T00:00:00`);
    d.setDate(d.getDate() - lead); // avisar N días antes
    d.setHours(hour, minute, 0, 0);
    if (isNaN(d.getTime()) || d.getTime() <= Date.now()) return null; // ya pasó o fecha inválida
    trigger = { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d };
  } else {
    // Mensual: avisamos N días antes del día del evento. Se limita a 1..28 para que exista siempre.
    const day = Math.min(Math.max((Number(item.day) || 1) - lead, 1), 28);
    trigger = { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day, hour, minute };
  }
  return Notifications.scheduleNotificationAsync({
    content: { title: dueTitle(item), body: dueBody(item) },
    trigger,
  });
}

export async function cancelDueNotification(notifId) {
  await cancelById(notifId);
}

// Reprograma todos los vencimientos guardados (por si se reinstaló la app). Evita duplicados.
export async function rescheduleAllDue() {
  try {
    const items = await getDueReminders();
    for (const it of items) {
      await cancelById(it.notif_id);
      const id = await scheduleDueNotification(it);
      await setDueReminderNotif(it.id, id || null);
    }
  } catch {
    // sin soporte de notificaciones
  }
}

export { DEFAULT_MSG };
