# Mis Gastos 📱

App Android para llevar el control de tus gastos. Todo se guarda **offline** en el teléfono (SQLite). Podés cargar gastos a mano o sacarle una foto a un ticket/PDF y que la app los detecte y clasifique sola por categoría.

## Qué hace

- **Resumen del mes**: total gastado y desglose por categoría con barras.
- **Carga manual**: descripción, monto, categoría, comercio y fecha.
- **Escanear**: foto (cámara o galería) o PDF → detecta los gastos, los clasifica y vos confirmás antes de guardar.
- **Últimos movimientos**: lista de gastos (mantené presionado para borrar).

## Cómo probarla en tu celular (rápido, sin compilar)

1. **Instalá Node.js** en la compu (si no lo tenés): https://nodejs.org (versión LTS).
2. **Instalá la app "Expo Go"** en tu Android desde la Play Store.
3. En la compu, abrí una terminal en esta carpeta y corré:

   ```bash
   npm install
   npx expo install --fix
   npx expo start
   ```

4. Va a aparecer un **código QR** en la terminal. Abrí **Expo Go** en el celular y escaneá el QR.
   - La compu y el celular tienen que estar en la **misma red WiFi**.
5. La app se abre en tu teléfono. Listo. 🎉

## Configurar el escaneo (API key gratis de Gemini)

La carga manual funciona sin nada extra. Para que el **escaneo** lea los tickets necesitás una API key gratis de Google:

1. Entrá a **https://aistudio.google.com/app/apikey** (con tu cuenta de Google).
2. Tocá **"Create API key"** y copiala.
3. En la app, andá a **Ajustes** (⚙︎ arriba a la derecha), pegá la key y guardá.

Es gratis dentro de la capa gratuita de Gemini, más que suficiente para uso personal.

## Estructura del proyecto

```
app/
  _layout.js     Navegación y arranque de la base de datos
  index.js       Pantalla principal (resumen)
  manual.js      Cargar gasto a mano
  scan.js        Escanear ticket/PDF y revisar
  settings.js    Cargar la API key de Gemini
src/
  db.js          Base de datos local (SQLite)
  extract.js     Lectura de comprobantes (Gemini) ← cambiar de proveedor acá
  categories.js  Lista de categorías
  format.js      Formato de moneda y fechas
```

## Cambiar de proveedor de lectura (ej: Claude)

Toda la lógica de "leer la imagen" está aislada en `src/extract.js`, en la función `extractExpenses()`. Para usar otro servicio (Claude, OCR local, etc.), reescribís solo esa función; el resto de la app no se toca.

## Convertir a APK instalable (más adelante, opcional)

Cuando quieras un `.apk` para instalar sin Expo Go:

```bash
npm install -g eas-cli
eas build -p android --profile preview
```

Requiere una cuenta gratis de Expo (https://expo.dev).
