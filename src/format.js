// Formato de moneda argentina y helpers de fecha.

export function formatMoney(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatBalance(amount, currency) {
  const n = Number(amount) || 0;
  if (currency === 'ARS') {
    return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }
  if (currency === 'USD') {
    return 'US$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // Cripto: hasta 8 decimales + símbolo.
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 }) + ' ' + currency;
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export function today() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function monthLabel(month) {
  const [y, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function shortDate(dateStr) {
  const [y, m, d] = (dateStr || '').split('-');
  if (!d) return dateStr || '';
  return `${Number(d)} ${MONTHS[Number(m) - 1]?.slice(0, 3) || ''}`;
}
