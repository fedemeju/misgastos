import { File } from 'expo-file-system';
import { getSetting } from './db';
import { CATEGORY_KEYS } from './categories';

// ============================================================================
//  EXTRACCIÓN DE GASTOS DESDE FOTO/PDF
//  Todo el "leer la imagen" vive acá. Hoy usa Google Gemini (capa gratuita).
//  Para cambiar de proveedor (ej: Claude), solo reescribís extractExpenses().
// ============================================================================

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = `Sos un asistente que lee comprobantes de gastos (tickets, facturas y sobre todo resúmenes de tarjeta de crédito) y extrae los gastos.
Analizá la imagen/PDF y devolvé SOLO un JSON válido (sin texto extra, sin markdown) con esta forma:

{
  "expenses": [
    {
      "description": "descripción corta del gasto o comercio",
      "amount": 1234.56,
      "category": "una de: ${CATEGORY_KEYS.join(', ')}",
      "merchant": "nombre del comercio si aparece, sino null",
      "date": "YYYY-MM-DD si aparece, sino null"
    }
  ],
  "documentTotal": 12345.67,
  "dueDate": "YYYY-MM-DD",
  "cardName": "Visa Supervielle"
}

Cómo decidir qué devolver:
- Si es un RESUMEN de tarjeta o de cuenta: devolvé un gasto por CADA CONSUMO o COMPRA real del período, cada uno con su importe, comercio, fecha y categoría. Recorré TODAS las páginas y no te saltees ninguno. SÍ incluí como gastos de categoría "financiacion": intereses, punitorios, mora, intereses por financiación y cargos financieros. NO incluyas: saldo anterior, pagos ya realizados, IVA, impuestos, percepciones ni sellados. En "documentTotal" poné el TOTAL A PAGAR del resumen (el importe final). En "dueDate" poné la FECHA DE VENCIMIENTO del resumen (buscá "Vencimiento", "Vto", "Fecha de pago").
- Si es un TICKET o factura de una sola compra: devolvé UN solo gasto con el TOTAL final pagado (ya con impuestos), poné ese mismo total en "documentTotal" y dejá "dueDate" en null.
- Trabajá con los importes en PESOS. Si hay una sección en dólares, ignorala.

Reglas:
- "amount" y "documentTotal" son números, sin símbolo de moneda ni separadores de miles. Usá punto para decimales.
- "dueDate" en formato YYYY-MM-DD, o null si no es un resumen o no encontrás vencimiento.
- "cardName": si es un resumen de tarjeta, el nombre de la tarjeta/banco (ej: "Visa Supervielle", "Mastercard Galicia"). Si es un ticket suelto, null.
- Elegí la "category" que mejor corresponda de la lista dada. Si no encaja en ninguna, usá "otros". Comida a domicilio (PedidosYa, Rappi, Uber Eats) = "delivery"; salir a comer, bar o café = "salidas".
- Si no encontrás ningún gasto, devolvé {"expenses": [], "documentTotal": null}.`;

function mimeFromUri(uri, fallback = 'image/jpeg') {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return fallback;
}

function extractJson(text) {
  // Gemini a veces envuelve el JSON en ```json ... ```. Lo limpiamos.
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('La respuesta no contenía JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalize(items) {
  const today = new Date().toISOString().slice(0, 10);
  return (items || [])
    .map((it) => ({
      description: String(it.description || 'Gasto').trim(),
      amount: Number(it.amount) || 0,
      category: CATEGORY_KEYS.includes(it.category) ? it.category : 'otros',
      merchant: it.merchant ? String(it.merchant).trim() : null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : today,
      source: 'scan',
    }))
    .filter((it) => it.amount > 0);
}

// Devuelve un array de gastos listos para revisar/guardar.
export async function extractExpenses(fileUri, mimeTypeHint) {
  const apiKey = await getSetting('gemini_api_key');
  if (!apiKey) {
    throw new Error('Falta la API key de Gemini. Cargala en Ajustes.');
  }

  const base64 = await new File(fileUri).base64();
  const mimeType = mimeTypeHint || mimeFromUri(fileUri);

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      response_mime_type: 'application/json',
      maxOutputTokens: 65536,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 400 && /API key/i.test(errText)) {
      throw new Error('La API key parece inválida. Revisala en Ajustes.');
    }
    if (res.status === 429) {
      throw new Error('Alcanzaste el límite de uso gratuito de Gemini por ahora. Esperá un momento y probá de nuevo.');
    }
    throw new Error(`Error del servicio (${res.status}). Probá de nuevo.`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No se pudo leer el comprobante. Probá con otra foto.');

  const parsed = extractJson(text);
  const docTotalNum = Number(parsed.documentTotal);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate) ? parsed.dueDate : null;
  const cardName = parsed.cardName ? String(parsed.cardName).trim() : null;
  return {
    items: normalize(parsed.expenses),
    documentTotal: Number.isFinite(docTotalNum) && docTotalNum > 0 ? docTotalNum : null,
    dueDate,
    cardName,
  };
}
