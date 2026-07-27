// Categorías de gasto. El campo `key` es lo que se guarda en la base de datos.
// Si agregás/cambiás categorías, actualizá también el prompt en extract.js
// para que Gemini use los mismos nombres.

export const CATEGORIES = [
  { key: 'supermercado', label: 'Supermercado', icon: '🛒', color: '#378ADD' },
  { key: 'transporte',   label: 'Transporte',   icon: '🚗', color: '#BA7517' },
  { key: 'servicios',    label: 'Servicios',    icon: '⚡', color: '#639922' },
  { key: 'salidas',      label: 'Salidas',      icon: '☕', color: '#D4537E' },
  { key: 'delivery',     label: 'Delivery',     icon: '🛵', color: '#DA6A2E' },
  { key: 'salud',        label: 'Salud',        icon: '➕', color: '#E24B4A' },
  { key: 'hogar',        label: 'Hogar',        icon: '🏠', color: '#7F77DD' },
  { key: 'financiacion', label: 'Financiación', icon: '💸', color: '#0F766E' },
  { key: 'otros',        label: 'Otros',        icon: '•',  color: '#888780' },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function getCategory(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}
