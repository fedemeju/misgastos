// Cotización de cripto en dólares (API gratuita de CoinGecko, sin key).

const COIN_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin',
  BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', ADA: 'cardano',
  DOGE: 'dogecoin', LTC: 'litecoin', TRX: 'tron', DOT: 'polkadot',
  MATIC: 'matic-network', AVAX: 'avalanche-2', LINK: 'chainlink',
  // Alias por si la cuenta se guardó con el nombre completo.
  BITCOIN: 'bitcoin', ETHEREUM: 'ethereum', SOLANA: 'solana',
  CARDANO: 'cardano', DOGECOIN: 'dogecoin', LITECOIN: 'litecoin',
  TETHER: 'tether', RIPPLE: 'ripple',
};

// Dólar oficial (Argentina) desde dolarapi.com. { compra, venta } o null.
export async function fetchDolarOficial() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial');
    if (!res.ok) return null;
    const d = await res.json();
    return { compra: Number(d.compra) || null, venta: Number(d.venta) || null };
  } catch {
    return null;
  }
}

// Nombre completo -> símbolo (ej. "ETHEREUM" -> "ETH").
const SYMBOL_ALIAS = {
  BITCOIN: 'BTC', ETHEREUM: 'ETH', SOLANA: 'SOL', CARDANO: 'ADA',
  DOGECOIN: 'DOGE', LITECOIN: 'LTC', TETHER: 'USDT', RIPPLE: 'XRP',
  POLKADOT: 'DOT', TRON: 'TRX', CHAINLINK: 'LINK',
};
function normSym(s) {
  const u = (s || '').toUpperCase();
  return SYMBOL_ALIAS[u] || u;
}

// Devuelve precios en USD por símbolo. Usa Binance (más confiable) y CoinGecko de respaldo.
// Las claves incluyen tanto el símbolo original como el normalizado.
export async function fetchCryptoPricesUsd(symbols) {
  const inputs = [...new Set((symbols || []).map((s) => (s || '').toUpperCase()).filter(Boolean))];
  if (inputs.length === 0) return {};
  const bases = [...new Set(inputs.map(normSym))];
  const priceByBase = {};
  if (bases.includes('USDT')) priceByBase.USDT = 1;

  // 1) Binance
  try {
    const pairs = bases.filter((b) => b !== 'USDT').map((b) => b + 'USDT');
    if (pairs.length) {
      const q = encodeURIComponent(JSON.stringify(pairs));
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${q}`);
      if (res.ok) {
        const arr = await res.json();
        for (const it of arr) {
          const base = String(it.symbol).replace(/USDT$/, '');
          const p = Number(it.price);
          if (p > 0) priceByBase[base] = p;
        }
      }
    }
  } catch {
    // sigue con CoinGecko
  }

  // 2) CoinGecko para lo que falte
  const missing = bases.filter((b) => priceByBase[b] == null);
  if (missing.length) {
    try {
      const ids = missing.map((b) => COIN_IDS[b]).filter(Boolean);
      if (ids.length) {
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`);
        if (res.ok) {
          const data = await res.json();
          for (const b of missing) {
            const id = COIN_IDS[b];
            if (id && data[id] && data[id].usd != null) priceByBase[b] = data[id].usd;
          }
        }
      }
    } catch {
      // se devuelve lo que haya
    }
  }

  const out = {};
  for (const s of inputs) {
    const b = normSym(s);
    if (priceByBase[b] != null) { out[s] = priceByBase[b]; out[b] = priceByBase[b]; }
  }
  return out;
}
