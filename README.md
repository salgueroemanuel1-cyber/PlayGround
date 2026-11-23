# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/salgueroemanuel1-cyber/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/salgueroemanuel1-cyber/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/salgueroemanuel1-cyber/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/salgueroemanuel1-cyber/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/salgueroemanuel1-cyber/PlayGround).
- 🛠️ [Check build runs](https://github.com/salgueroemanuel1-cyber/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/salgueroemanuel1-cyber/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/salgueroemanuel1-cyber).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

## ÓXIDO AUSTRAL — RTS táctil

Partida corta de estrategia en tiempo real, isométrica y dibujada por completo con canvas. No requiere dependencias, instalación ni compilación: es HTML, CSS y JavaScript estáticos.

### Jugar en Android

1. Serví esta carpeta desde una computadora en la misma red Wi-Fi:

   ```bash
   python3 -m http.server 3002
   ```

2. Abrí `http://IP-DE-TU-COMPUTADORA:3002` en Chrome para Android.
3. Girá el teléfono a horizontal para tener más campo de batalla.
4. Opcional: menú de Chrome → **Añadir a pantalla de inicio** para jugarlo como app.

También funciona con `?play=1` para saltar la portada.

### Controles táctiles

| Gesto | Acción |
| --- | --- |
| Tocar | Seleccionar una unidad o estructura. Con tropas elegidas, tocar el suelo las mueve y tocar un enemigo lo ataca. |
| Doble toque | Seleccionar todas las unidades del mismo tipo en pantalla. |
| Arrastrar | Recuadro de selección múltiple. |
| Dos dedos | Arrastrar para mover la cámara y pellizcar para acercar o alejar. |
| Mantener presionado | Menú de órdenes: atacar, mover, patrullar o detener. |
| Minimapa | Tocar o arrastrar para saltar a cualquier zona del mapa. |
| Pausa | Botón superior derecho: seguir, velocidad 1×/1.5×/2×, pantalla completa o reiniciar. |

### Bucle de partida

- Producí **Tiradores**, **Lanzachatarra** y **Mecánicos** en la **Refinería**.
- La **Cigüeña** bombea petróleo; la **Antena** del centro se captura con infantería y da ingresos extra.
- Recolectá **chatarra** de los enemigos caídos y comprá **Chapa +20%**.
- Sobreviví a las oleadas bestiales y destruí el **Nido** al sureste para ganar. Si cae tu refinería, perdés.

### Archivos

- `index.html` — estructura del HUD, menús y pantallas.
- `styles.css` — interfaz mobile-first, áreas seguras y modo horizontal.
- `game.js` — simulación, economía, IA, combate y render isométrico procedural.

