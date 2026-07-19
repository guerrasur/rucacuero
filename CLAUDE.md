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

## Mapa de módulos (todos en `js/`, ~2600 líneas en total)

- `state.js` — objeto `state` + load/save/autosave. Schema del save:
  `{ v:1, ants, sap, height, bestHeight,
  upgrades:{feromonas,reina,nudos,mielada,ofrenda}, unlocks:[ids],
  quest:{id,target,progress}|null, questsDone,
  life:{metros,perfectos,chucaos,lluvias,gastadas,enjambres}, logros:[ids] }`.
  Migración aditiva sin bump de versión: campos faltantes → defaults.
  Clave aparte: `rucacuero_muted` ('1'/'0').
- `economy.js` — `UPGRADES` (5; `ofrenda` es repetible sin tope, +5%/nivel,
  costo ×3, `requiresAllMaxed`), `SAP_UNLOCKS` (umbrales 50/150/400/900/2000),
  `antRate()`, `SAP_RATE=0.2`, `slipChance(windy)` (8% base ×0.82^nudos,
  piso 1%), `tick(dt, sapMul)`, `buy()`.
- `climb.js` — el corazón: nudos deterministas (`knotHeight(i)` memoizado,
  `knotIndexAbove(h)` búsqueda binaria), `ZONES` (7 zonas: 0/30/70/120/180/
  260/360 que cambian verde/gapMul/savia/viento), objeto `wind`
  (calm→warn→gust) y objeto `climb` (máquina de estados
  idle→charging→leaping→slipping). Constantes clave: `MAX_JUMP=6` m,
  `CHARGE_SPEED=0.55` pot/s, zona dulce ±0.55 m (±0.30 con ráfaga, ±0.38 con
  unlock `brisa`), `PERFECT_W=0.14` (soltada dentro de ±0.14 = agarre
  perfecto, **inmune a la tirada de mala suerte** — la micro-zona premia la
  precisión, se dibuja siempre con pulso + bordes hueso + glow). Racha de
  perfectos: `STREAK_MULTS=[1,1.1,1.2,1.3,1.5,1.7,2]` multiplica los metros
  ganados (impulso extra en `release()`, solo suma); cualquier soltada no
  perfecta la corta (`breakStreak()`); badge `#mult` en el HUD con animación
  pop por cada perfecto. Pérdidas: corto −1.2, pasado −3.0,
  mala suerte −2.2 (clamp a 0). `climb.mods` = hooks inyectados por main
  (lluvia/niebla: slipBonus/sweetMul). Eventos via `emit()`/`takeEvents()`.
- `events.js` — `branchEvents`, un evento a la vez, cooldown 40-80 s, spawn
  por tabla de pesos: lluvia 0.30 (savia ×2, resbalón +4%, dulce ×0.92,
  ~20 s), chucao 0.25 (12 s posado; tocarlo = bono de hormigas), niebla 0.25
  (solo con height>12: savia ×1.5, dulce ×0.88, SIN resbalón extra, ~20 s) y
  enjambre de luciérnagas 0.20 (10 s; tocarlo = bono de hormigas via
  `tapSwarm()`). Si `state.quest.id==='bird'`, el próximo spawn garantiza
  pájaro.
- `quests.js` — pool de 6 misiones rotativas (una activa), progreso en
  `state.quest`, recompensa en hormigas que escala con `questsDone`.
  `note(kind, amount, ctx)` es el único punto de entrada.
- `logros.js` — 12 logros permanentes (`LOGROS`): métricas acumulativas en
  `state.life` (via `bump(metric, amount)`, único entry point) + derivadas
  récord/misiones (via `checkDerived()`, llamada por main solo cuando hubo
  eventos). Recompensa en hormigas, solo suma. UI: sección en la sheet.
- `scene.js` — render canvas (contexto `{alpha:false}`). Cámara sigue
  `climb.visualHeight()`; `CHAR_Y=0.7`, `VISIBLE_M=9`. Dibuja: follaje
  parallax (sprites pre-renderizados), luciérnagas, rama (dos verdes +
  contorno, verde por zona con `zoneVerde()`), nudos (+anillo objetivo,
  savia con glow sprite), marcas cada 10 m, banderín de récord, hormigas,
  overlays de carga (banda dulce + chevron + medidor), escalador (paths por
  poses), chucao, enjambre (glow + puntitos savia), partículas, viento
  (Path2D), niebla (bandas de `fogSprite` + velo), lluvia, viñeta.
  `scene.birdPos` y `scene.swarmPos` los usa main para el hit-test del tap.
- `ui.js` — HUD (escrituras DOM **solo cuando cambia el texto** — mantener),
  tienda bottom-sheet (mejoras + savia + logros), toasts, `showBanner()`,
  `flash()`, chip de misión (abajo, entre tienda y mute, `pointer-events:
  none` — el tap pasa al canvas), clase `body.charging` que atenúa
  HUD/toasts/chip durante la carga (la zona de puntería queda limpia), mute
  (los SVG no tienen `.hidden`: usar `toggleAttribute`).
- `audio.js` — todo procedural con WebAudio (sin assets). `ensure()` debe
  llamarse desde un gesto. Loops con estado: carga (osc), lluvia (noise) y
  ambiente (pad de viento lowpass 180 Hz + grillos; `ambientUpdate(dt, ctx)`
  por frame desde main — se calla con lluvia, crece con niebla, cede en
  ráfaga; cuelga de master, el mute lo silencia solo).
- `main.js` — wiring y loop. Traduce eventos de climb/branchEvents/quests/
  logros a audio + partículas + UI. Registra el service worker (NO en
  localhost salvo `?sw=1`). Expone `window.__ruca =
  { state, climb, wind, economy, events, quests, logros, scene }`.

## Performance (ya optimizado — no regresar)

Canvas opaco; gradientes/blobs SOLO en sprites pre-renderizados (constructor
de Scene), jamás crear `createRadialGradient` dentro del frame; nudos visibles
por búsqueda binaria; arrays de `setLineDash` como constantes; DPR cap 2.
Medido: ~51-60 FPS en headless por software (incluso con niebla+enjambre); 60
en GPU real.

## PWA

`manifest.json` + `sw.js` (cache-first, precache cerrado) + `icons/`.
**REGLA: cualquier cambio en un asset requiere bumpear `CACHE`
(`rucacuero-vN`) en `sw.js`** o los usuarios instalados no ven la novedad.
En localhost el SW no se registra salvo `?sw=1` — desarrollo y tests siempre
ven la versión fresca. Los PNG de `icons/` se generaron una vez desde
`icons/icon.svg` con Playwright (screenshot); no hay build.

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
    y tocar en `__ruca.scene.birdPos`. Forzar niebla: `__ruca.events.fog =
    {t:2, dur:60}`. Forzar enjambre: `__ruca.events.swarm =
    {h: state.height+3, side:1, t:2, dur:60}` y tocar en `__ruca.scene.swarmPos`.
  - **Trampa de persistencia**: inyectar localStorage y luego `reload()` NO
    funciona — `pagehide` guarda el estado en memoria encima. Inyectar con
    `context.addInitScript()` antes de cargar la página.
- Chequear siempre: sin errores en consola, y los tres resultados de salto
  (dulce/corto/pasado) con las pérdidas esperadas.

## Git

Branch de trabajo actual: `claude/game-improvements-hmaebk` (los branches de
iteraciones anteriores ya se mergearon a `main`). Commits en español,
descriptivos. No abrir PR salvo pedido explícito.

## Ideas pendientes (aprobadas a grandes rasgos, no comprometidas)

Más eventos de rama (siempre sin quitarle nada al jugador); más logros o un
prestige suave para el endgame profundo; modos de accesibilidad (reducción de
movimiento); compartir el récord como imagen.
