Mini app "Noche Bajo las Estrellas"

Descripción
- Abre la cámara del dispositivo (tras permiso del usuario).
- Dibuja estrellas con efecto parallax y destellos.
- Traza "constelaciones" estéticas y muestra sus nombres.
- Muestra un encabezado y tu logo al estilo del afiche.

Estructura
- `index.html` – Maquetado y controles (cámara, brújula, toggle de constelaciones)
- `styles.css` – Estilos con paleta morado + dorado
- `app.js` – Lógica: cámara, giroscopio, render del cielo
- `assets/logo.svg` – Logo de ejemplo. Reemplázalo por el tuyo

Uso local
1) Abre `index.html` en un navegador (Chrome/Edge/Firefox). Para iOS usa HTTPS (ver GitHub Pages) porque Safari exige contexto seguro para cámara/giroscopio.
2) Presiona "Permitir cámara" si no arranca sola.
3) En iOS, toca "Activar brújula" para conceder permiso de orientación.

Publicar en GitHub Pages
1) Sube estos archivos a un repo.
2) En GitHub: Settings → Pages → Source: `Deploy from a branch` y elige `main`/`root`.
3) Espera el build. Tu sitio quedará en `https://<usuario>.github.io/<repo>/`.

Personalización rápida
- Texto del encabezado y lugar/horario: edita `index.html`.
- Colores: variables CSS en `styles.css` (`--purple`, `--gold`).
- Logo: reemplaza `assets/logo.svg` por tu PNG/SVG y conserva el nombre o ajusta `index.html`.
- Número de estrellas o brillo: `createStars()` en `app.js`.

Notas
- Este demo NO calcula posiciones astronómicas reales; usa un campo estelar estético con parallax por orientación.
- En iOS 13+ es obligatorio el gesto de usuario para `DeviceOrientationEvent.requestPermission()`.

