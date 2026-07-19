# CLAUDE.md — Ruca Cuero

Juego web mobile-first (vertical) de escalar una rama gigante. HTML/CSS/JS
vanilla con ES modules, **sin build, sin dependencias, sin framework**. Se
sirve estático: `python3 -m http.server 8123` y abrir `http://localhost:8123`.

Idioma del proyecto: **español rioplatense** (UI, comentarios, commits).
Formato de números: `toLocaleString('es-AR')` (coma decimal).

## Reglas de diseño INVIOLABLES (vienen del pedido del usuario)

1. **Tres capas de progreso aisladas**:
   - **Hormigas**: moneda pasiva, se genera solo con el juego abierto, se
     gasta en mejoras. Nada puede *quitarle* hormigas al jugador salvo sus
     propias compras (el chucao regala, jamás roba).
   - **Altura**: manual. Solo baja por fallo de habilidad (salto corto o
     pasado) o mala suerte (tirada tras agarre limpio). **Nunca** baja por
     razones económicas.
   - **Savia**: pasiva y constante, **nunca se gasta ni baja**; sus umbrales
     desbloquean mejoras funcionales permanentes.
2. **Sin progreso offline**: no se simula tiempo al reabrir. El loop usa
   `requestAnimationFrame` con `dt` clampeado a 0.05 s — eso ya lo garantiza;
   no romperlo.
3. Todo el estado persiste en localStorage, clave `rucacuero_save_v1`
   (autosave cada 5 s + `visibilitychange`/`pagehide`).

## Dirección visual: "xilografía nocturna" (mantener disciplina)

Formas planas + contornos gruesos de tinta. **Un solo acento cálido (Savia)**.
Paleta (en `css/style.css` como custom properties y en `js/scene.js` const `C`):
Noche de Monte `#131B12` (fondo) · Verde Cuero `#7FA636` (rama) · Musgo Hondo
`#43601F` (sombras/estrías) · Savia `#F0A32A` (único acento) · Hueso `#F2E8CE`
(texto/viento) · Tinta de Hormiga `#2A1C14` (contornos/paneles) · Ocre
`#C9825A` (piel del escalador y chucao, extra permitido).
Tipos: **Chango** (display) + **Bricolage Grotesque** (texto), self-hosteadas
en `fonts/` (no volver a CDN). Elemento firma: **el viento dibujado** (trazos
hueso que angostan la zona dulce — el peligro se ve, no se anuncia con UI).

## Mapa de módulos (todos en `js/`, ~1200 líneas en total)

- `state.js` — objeto `state` + load/save/autosave. Schema del save:
  `{ v:1, ants, sap, height, bestHeight, upgrades:{feromonas,reina,nudos,mielada},
  unlocks:[ids], quest:{id,target,progress}|null, questsDone }`.
  Clave aparte: `rucacuero_muted` ('1'/'0').
- `economy.js` — `UPGRADES`, `SAP_UNLOCKS` (umbrales 50/150/400/900),
  `antRate()`, `SAP_RATE=0.2`, `slipChance(windy)` (8% base ×0.82^nudos,
  piso 1%), `tick(dt, sapMul)`, `buy()`.
- `climb.js` — el corazón: nudos deterministas (`knotHeight(i)` memoizado,
  `knotIndexAbove(h)` búsqueda binaria), `ZONES` (5 zonas cada ~30-180 m que
  cambian verde/gapMul/savia/viento), objeto `wind` (calm→warn→gust) y objeto
  `climb` (máquina de estados idle→charging→leaping→slipping). Constantes
  clave: `MAX_JUMP=6` m, `CHARGE_SPEED=0.55` pot/s, zona dulce ±0.55 m
  (±0.30 con ráfaga), `PERFECT_W=0.14`. Pérdidas: corto −1.2, pasado −3.0,
  mala suerte −2.2 (clamp a 0). `climb.mods` = hooks inyectados por main
  (lluvia: slipBonus/sweetMul). Eventos via `emit()`/`takeEvents()`.
- `events.js` — `branchEvents`: lluvia (savia ×2, resbalón +4%, dulce ×0.92,
  ~20 s) y chucao (12 s posado; tocarlo = bono de hormigas). Cooldown 40-80 s.
  Si `state.quest.id==='bird'`, el próximo spawn garantiza pájaro.
- `quests.js` — pool de 6 misiones rotativas (una activa), progreso en
  `state.quest`, recompensa en hormigas que escala con `questsDone`.
  `note(kind, amount, ctx)` es el único punto de entrada.
- `scene.js` — render canvas (contexto `{alpha:false}`). Cámara sigue
  `climb.visualHeight()`; `CHAR_Y=0.7`, `VISIBLE_M=9`. Dibuja: follaje
  parallax (sprites pre-renderizados), luciérnagas, rama (dos verdes +
  contorno, verde por zona con `zoneVerde()`), nudos (+anillo objetivo,
  savia con glow sprite), marcas cada 10 m, banderín de récord, hormigas,
  overlays de carga (banda dulce + chevron + medidor), escalador (paths por
  poses), chucao, partículas, viento (Path2D), lluvia, viñeta.
  `scene.birdPos` lo usa main para el hit-test del tap.
- `ui.js` — HUD (escrituras DOM **solo cuando cambia el texto** — mantener),
  tienda bottom-sheet, toasts, `showBanner()`, `flash()`, chip de misión,
  mute (los SVG no tienen `.hidden`: usar `toggleAttribute`).
- `audio.js` — todo procedural con WebAudio (sin assets). `ensure()` debe
  llamarse desde un gesto. Loops con estado: carga (osc) y lluvia (noise).
- `main.js` — wiring y loop. Traduce eventos de climb/branchEvents/quests a
  audio + partículas + UI + misiones. Expone `window.__ruca =
  { state, climb, wind, economy, events, quests, scene }` para debug/tests.

## Performance (ya optimizado — no regresar)

Canvas opaco; gradientes/blobs SOLO en sprites pre-renderizados (constructor
de Scene), jamás crear `createRadialGradient` dentro del frame; nudos visibles
por búsqueda binaria; arrays de `setLineDash` como constantes; DPR cap 2.
Medido: ~51 FPS en headless por software; 60 en GPU real.

## Cómo verificar (Playwright, ya instalado en el scratchpad de sesiones previas)

- Chromium preinstalado: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`
  (NO correr `playwright install`). Viewport móvil 390×844, `hasTouch: true`.
- Servidor: `python3 -m http.server 8123` en la raíz del repo.
- Handle de debug: `window.__ruca`. Ejemplos:
  - Salto en zona dulce: gap = `knotHeight(nextKnotIndex(h)) - h`; mantener
    `(gap/6/0.55)*1000` ms y soltar. Ojo: jitter post-reload puede fallar el
    primer salto (esperar ~1.5 s tras cargar).
  - Forzar lluvia: `__ruca.events.rain = {t:2, dur:60}`. Forzar chucao:
    `__ruca.events.bird = {h: state.height+3, side:1, t:0, dur:12, phase:'perch', flyT:0}`
    y tocar en `__ruca.scene.birdPos`.
  - **Trampa de persistencia**: inyectar localStorage y luego `reload()` NO
    funciona — `pagehide` guarda el estado en memoria encima. Inyectar con
    `context.addInitScript()` antes de cargar la página.
- Chequear siempre: sin errores en consola, y los tres resultados de salto
  (dulce/corto/pasado) con las pérdidas esperadas.

## Git

Branch de trabajo: `claude/ruca-cuero-game-prototype-so7ihd` → PR #2 abierto
contra `main` (se actualiza al pushear). Commits en español, descriptivos.

## Ideas pendientes (aprobadas a grandes rasgos, no comprometidas)

PWA (manifest + service worker) para instalar en el celular; más eventos
(siempre sin quitarle nada al jugador); logros de largo plazo además de las
misiones rotativas; sonido ambiente del monte de noche.
