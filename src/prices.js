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

// Devuelve { BTC: 65000, ETH: 3200, ... } en USD. Si falla, {}.
export async function fetchCryptoPricesUsd(symbols) {
  const wanted = [...new Set((symbols || []).map((s) => (s || '').toUpperCase()))];
  const ids = wanted.map((s) => COIN_IDS[s]).filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const out = {};
    for (const [sym, id] of Object.entries(COIN_IDS)) {
      if (data[id] && data[id].usd != null) out[sym] = data[id].usd;
    }
    return out;
  } catch {
    return {};
  }
}
