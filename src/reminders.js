import * as Notifications from 'expo-notifications';
import { getSetting } from './db';

const DEFAULT_MSG = 'No te olvides de cargar tus gastos e ingresos de hoy 💸';

// Programa (o reprograma) el recordatorio diario a la hora dada.
export async function scheduleDailyReminder(hour, minute, message) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: { title: 'Mis Gastos', body: message || DEFAULT_MSG },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  return true;
}

export async function cancelReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
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

export { DEFAULT_MSG };
