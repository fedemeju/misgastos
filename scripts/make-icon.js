const Jimp = require('jimp');

const SRC = 'C:/Users/User/Downloads/Diseño sin título (22).png';
const OUT_DIR = 'C:/Users/User/Desktop/tragosWEB/gastos-app/assets';

(async () => {
  const img = await Jimp.read(SRC);
  const w = img.bitmap.width;
  const h = img.bitmap.height;

  // Color de fondo verde (muestreo dentro del cuadro, arriba a la izquierda).
  const sage = Jimp.intToRGBA(img.getPixelColor(Math.round(w * 0.12), Math.round(h * 0.5)));
  const sageHex = '#' + [sage.r, sage.g, sage.b].map((n) => n.toString(16).padStart(2, '0')).join('');

  // Blanco de las esquinas -> transparente.
  img.scan(0, 0, w, h, function (x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    if (r > 236 && g > 236 && b > 236) this.bitmap.data[idx + 3] = 0;
  });

  // Ícono principal (1024x1024).
  const icon = img.clone().resize(1024, 1024);
  await icon.writeAsync(`${OUT_DIR}/icon.png`);

  // Foreground adaptativo Android: el cuadro dentro de la zona segura (~70%),
  // sobre lienzo transparente 1024, para que el fondo verde rellene los bordes.
  const inner = img.clone().resize(720, 720);
  const fg = new Jimp(1024, 1024, 0x00000000);
  fg.composite(inner, (1024 - 720) / 2, (1024 - 720) / 2);
  await fg.writeAsync(`${OUT_DIR}/adaptive-icon.png`);

  console.log('SAGE=' + sageHex);
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
