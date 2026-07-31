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
  { key: 'mercadolibre', label: 'Mercado Libre', icon: '📦', color: '#E8A200' },
  { key: 'ropa',         label: 'Ropa',         icon: '👕', color: '#C2569B' },
  { key: 'tecnologia',   label: 'Tecnología',   icon: '💻', color: '#2C7BE5' },
  { key: 'mascotas',     label: 'Mascotas',     icon: '🐾', color: '#16A085' },
  { key: 'suscripciones',label: 'Suscripciones', icon: '📺', color: '#8E44AD' },
  { key: 'viajes',       label: 'Viajes',       icon: '✈️', color: '#0E8AA0' },
  { key: 'financiacion', label: 'Financiación', icon: '💸', color: '#0F766E' },
  { key: 'otros',        label: 'Otros',        icon: '•',  color: '#888780' },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function getCategory(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

// Categorías de ingreso.
export const INCOME_CATEGORIES = [
  { key: 'sueldo',    label: 'Sueldo',    icon: '💼', color: '#1D9E75' },
  { key: 'freelance', label: 'Freelance', icon: '💻', color: '#378ADD' },
  { key: 'ventas',    label: 'Ventas',    icon: '🏷️', color: '#BA7517' },
  { key: 'extra',     label: 'Extra',     icon: '✨', color: '#7F77DD' },
  { key: 'otros',     label: 'Otros',     icon: '•',  color: '#888780' },
];

export function getIncomeCategory(key) {
  return INCOME_CATEGORIES.find((c) => c.key === key) || INCOME_CATEGORIES[INCOME_CATEGORIES.length - 1];
}
