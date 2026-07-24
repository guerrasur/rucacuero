# CLAUDE.md — Ruca Cuero

Juego web mobile-first (vertical) de escalar una rama gigante. HTML/CSS/JS
vanilla con ES modules, **sin build, sin dependencias, sin framework**. Se
sirve estático: `python3 -m http.server 8123` y abrir `http://localhost:8123`.

Idioma del proyecto: **español rioplatense** (UI, comentarios, commits).
Formato de números: `toLocaleString('es-AR')` (coma decimal). La altura/distancia
se muestra con `fmtAltura`/`altNum`/`altUnidad` (state.js): metros hasta 1000,
kilómetros con 2 decimales de ahí para arriba (1024 m → "1,02 km").

## Dos modos (botón `#modo-btn`)

- **Carrera** (principal, default): contrarreloj desde la tierra (5 s pelados;
  la mejora `reloj` sigue la tabla `RELOJ_TIEMPOS` — 7 s al primer nivel,
  escalones crecientes hasta 90 s MÁX en nv 12). La puntería es SIEMPRE a
  escala base contra el próximo nudo; los perfectos encadenados multiplican los
  **metros ganados al agarrar**, exponencial y sin tope
  (`gainMul = resorte × 1,25^racha`): el salto te eleva de largo pasando ramas
  enteras, y el aterrizaje se ancla SIEMPRE al nudo más cercano (caer entre
  ramas dejaba nudos a centímetros y regalaba rachas perdidas). La mecánica de
  racha corre igual en zen (sin resorte/eco, que son coloradas). La escala del render es fija (NADA de zoom — estiraba el árbol y
  movía el objetivo); en vuelos/caídas rápidas la cámara se engancha al
  escalador (clamp ±2,5 m sobre el lerp). Al agotarse el tiempo cae a la tierra (queda tumbado ~1,1 s y se
  levanta, `run.ground`) y la altura pico paga **hormigas coloradas** (HUD en
  ocre) con 4 mejoras propias (`carrera.js`). Récord y altura por modo. El piso
  curvo de tierra se dibuja en ambos modos (`drawGround`).
- **Zen**: el juego original intacto (escalada libre persistente, hormigas
  negras pasivas, eventos de rama y misiones SOLO acá). La savia y sus unlocks
  corren en ambos modos. `state.height/bestHeight` son siempre del modo activo;
  `state.zen` y `state.carrera` guardan lo persistente de cada uno (save viejo
  migra su altura al zen).

## Reglas de diseño INVIOLABLES (vienen del pedido del usuario)

1. **Cuatro capas de progreso aisladas**:
   - **Hormigas**: moneda pasiva, se genera solo con el juego abierto, se
     gasta en mejoras. Nada puede *quitarle* hormigas al jugador salvo sus
     propias compras (el chucao regala, jamás roba).
   - **Altura**: manual. Solo baja por fallo de habilidad (salto corto o
     pasado) o mala suerte (tirada tras agarre limpio). **Nunca** baja por
     razones económicas. Única excepción: el "rebirth" VOLUNTARIO (bajar a la
     zona 0), pedido explícito del usuario y confirmado con dos toques; no
     quita hormigas/savia/récord.
   - **Savia**: pasiva y constante, **nunca se gasta ni baja**; sus umbrales
     desbloquean mejoras funcionales permanentes.
   - **Prestige (Anillos del monte)**: capa PURAMENTE ADITIVA, **solo sube,
     jamás baja**. El rebirth voluntario cambia la altura que se sacrifica por
     anillos permanentes (`carrera.anillosPorAltura(h)=floor(√(h/8))`, piso
     20 m); cada anillo suma un bono fijo a la generación de hormigas —negras y
     coloradas— vía `economy.prestigeMul()=1+0,02·anillos`. NO toca la savia
     (sus umbrales son fijos). Vive en `state.prestige.anillos`.
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
  `{ v:1, mode:'carrera'|'zen', ants, sap, height, bestHeight,
  zen:{height,best},
  carrera:{ants,best,upgrades:{resorte,reloj,eco,botin,primosalto,rachadivina,zancada,ventil},pisos:[bool]},
  upgrades:{feromonas,reina,nudos,mielada,ofrenda}, unlocks:[ids],
  quest:{id,target,progress}|null, questsDone,
  life:{metros,perfectos,chucaos,lluvias,gastadas,enjambres}, logros:[ids],
  cuento, prestige:{anillos}, opts:{menosMov:bool|null},
  cosmetics:{owned:[ids], sombrero:id|null, chiripa:id|null, piel:id} }`.
  Migración aditiva sin bump de versión: campos faltantes → defaults.
  Clave aparte: `rucacuero_muted` ('1'/'0').
- `economy.js` — `UPGRADES` (5; `ofrenda` es repetible sin tope, +5%/nivel,
  costo ×3, `requiresAllMaxed`), `SAP_UNLOCKS` (umbrales 50/150/400/900/2000),
  `antRate()` (multiplica por `prestigeMul()`), `SAP_RATE=0.2`,
  `PRESTIGE_RATE=0.02` + `prestigeMul()` (bono aditivo de anillos, solo a
  hormigas), `slipChance(windy)` (8% base ×0.82^nudos,
  piso 1%), `tick(dt, sapMul, genAnts)` (negras solo en zen; savia siempre),
  `buy()`.
- `carrera.js` — modo carrera: `R_UPGRADES` (8, en coloradas: resorte/reloj/eco/
  botin + `primosalto` (envión de partida gratis, +metros por nivel vía tabla
  fija `PRIMOSALTO_METROS` — 20/50/100 y de ahí se duplica —, respeta pisos
  vía `primosaltoMetros()` aplicado en `run.onPress()`),
  `rachadivina` (al fallar, la racha se recorta en vez de resetear — climb la
  lee), `zancada` (piso extra de metros en un agarre común — climb la lee) y
  `ventil` "Ventil Forte" (la ráfaga angosta menos la zona dulce, sin pasar la
  base — climb la lee en `sweetW()`)), `timeTotal()`
  (tabla `RELOJ_TIEMPOS`, 5→7→…→90 s),
  objeto `run` (active/started/left/peak/falling; `onPress()` ARMA la carrera
  con el reloj EN PAUSA, `onGrab()` — main lo llama al primer agarre/perfecto —
  recién arranca el reloj: el salto inicial y sus reintentos NO descuentan
  tiempo; `update(dt)` corre el reloj solo si `started` y dispara la caída a la
  tierra con `climb.startSlip(h, 0, dur)`, `finish()` SIEMPRE paga el botín) y
  `setMode()` (swap de alturas zen↔carrera, la carrera SIEMPRE arranca desde la
  tierra, + `climb.resetForMode()`). `volverAZona0()` es el "rebirth" suave:
  baja la altura del modo activo a 0 sin tocar hormigas/savia/mejoras/récord y
  paga anillos del monte por la altura sacrificada (`anillosPorAltura(h)`,
  prestige aditivo; devuelve cuántos ganó para la UI).
  Importa `state`, `climb` y `prestigeMul` de economy (sin ciclos).
- `cosmetics.js` — el Ropero: `SKINS` (11 pieles gratis, `skinHex(id)` con
  fallback a ocre) y `COSMETICS` (compra única con hormigas, slots
  `sombrero`/`chiripa`; `buyCosmetic()` auto-equipa, `setEquipped()`,
  `sanitize()` valida el save — main la llama tras `load()`). Solo importa
  `state.js` (sin ciclos). El dibujo vive en `scene.js` como funciones de
  módulo compartidas: `drawFigure(ctx,t,pose,cos)` (escena + probador),
  `drawProbador` (maniquí con rama de fondo), `drawCosmeticIcon` (iconos de
  cartas) e `idlePose`; el chucao queda siempre ocre.
- `climb.js` — el corazón: nudos deterministas (`knotHeight(i)` memoizado,
  `knotIndexAbove(h)` búsqueda binaria), `ZONES` (7 zonas: 0/30/70/120/180/
  260/360 que cambian verde/gapMul/savia/viento), objeto `wind`
  (calm→warn→gust) y objeto `climb` (máquina de estados
  idle→charging→leaping→slipping). Constantes clave: `MAX_JUMP=6` m,
  `CHARGE_SPEED=0.55` pot/s, zona dulce ±0.55 m (±0.30 con ráfaga, ±0.38 con
  unlock `brisa`), `PERFECT_W=0.14` (soltada dentro de ±0.14 = agarre
  perfecto, **inmune a la tirada de mala suerte** — la micro-zona premia la
  precisión, se dibuja siempre con pulso + bordes hueso + glow, y también se
  marca en savia sobre el medidor lateral). Racha de perfectos UNIFICADA:
  `gainMul()` exponencial sin tope en ambos modos (`1,25^racha`; carrera suma
  resorte/eco) y aterrizaje SIEMPRE anclado al nudo más cercano; cualquier
  soltada no perfecta la corta (`breakStreak()`); badge `#mult` en el HUD con
  pop por perfecto. Al soltar un perfecto se emite `perfect-release` →
  `scene.perfectFlash()` (destello inmediato de la banda dorada, no espera el
  aterrizaje). El hueco entre nudos se topea a
  `MAX_KNOT_GAP = MAX_JUMP - 2·SWEET_BASE` (4,9 m) para que a carga máxima
  SIEMPRE quede aire para pasarse: un nudo pegado al tope del salto se resolvía
  como "perfecto" con solo mantener presionado (bug corregido). La racha se corta
  con `breakStreak(hard)`: `hard` resetea entero (cambio de modo / fin de
  carrera), sin `hard` en carrera la mejora `rachadivina` conserva una fracción
  (`RACHA_DIVINA_KEEP`). La mejora `zancada` suma `RUN_ZANCADA·nivel` metros a un
  agarre común (no perfecto). `MIN_TARGET_GAP = MAX_JUMP*0.5` (3 m):
  si el próximo nudo exige menos del 50% de la carga, `press()` apunta directo
  al siguiente cuando entra en el salto máximo (`MAX_JUMP + 0.1`) — nunca un
  objetivo sin tiempo de reacción ni rachas perdidas por un tronco mal
  posicionado. Los textos
  flotantes (`#feedback`, `#zone-banner`) se esfuman durante la carga vía
  `filter` (sus animaciones pisan `opacity`). `leapDur` escala con la distancia del vuelo. Pérdidas: corto −1.2, pasado −3.0,
  mala suerte −2.2 (clamp a 0, el piso es siempre la tierra). `climb.mods` =
  hooks inyectados por main (lluvia/niebla: slipBonus/sweetMul). Eventos via
  `emit()`/`takeEvents()`. Cruzar una frontera de zona emite `'zone'` (banner
  con el nombre de la zona).
- `events.js` — `branchEvents`, un evento a la vez, cooldown 40-80 s, spawn
  por tabla de pesos: lluvia 0.26 (savia ×2, resbalón +4%, dulce ×0.92,
  ~20 s), chucao 0.22 (12 s posado; tocarlo = bono de hormigas), enjambre de
  luciérnagas 0.18 (10 s; tocarlo = bono via `tapSwarm()`), rocío 0.16 (el
  ÚNICO clima que ENSANCHA la dulce ×1.15, savia ×1.5, sin resbalón, ~16-22 s)
  y —según altura— niebla 0.20 (height>12: savia ×1.5, dulce ×0.88, SIN
  resbalón, ~20 s) y granizo 0.14 (height>25: puro espectáculo, `hail-end`
  paga un bono de hormigas). Si `state.quest.id==='bird'`, el próximo spawn
  garantiza pájaro. Ningún evento resta nada.
- `quests.js` — pool de 6 misiones rotativas (una activa), progreso en
  `state.quest`, recompensa en hormigas que escala con `questsDone`.
  `note(kind, amount, ctx)` es el único punto de entrada. Además `CUENTO` ("El
  cuento del monte"): 5 pasos con `relato`, intercalado cada 3 misiones
  comunes, progreso en `state.cuento`, paga doble y emite `quest-done` con el
  texto de la historia.
- `logros.js` — 17 logros permanentes (`LOGROS`): métricas acumulativas en
  `state.life` (via `bump(metric, amount)`, único entry point) + derivadas
  récord/misiones/cuento/anillos (via `checkDerived()`, llamada por main —y por
  ui tras el rebirth— solo cuando hubo eventos). Recompensa en hormigas, solo
  suma. UI: solapa Trofeos de la tienda.
- `scene.js` — render canvas (contexto `{alpha:false}`). Cámara sigue
  `climb.visualHeight()`; `CHAR_Y=0.7`, `VISIBLE_M=9`. Fondo pareja: la noche
  del monte (`C.noche`) en toda la subida. Dibuja: follaje parallax (sprites
  pre-renderizados), luciérnagas, rama (dos verdes + contorno, verde por zona
  con `zoneVerde()`), nudos (+anillo objetivo, savia con glow sprite), marcas
  cada 10 m, banderín de récord, hormigas, overlays de carga (banda dulce +
  chevron + medidor), escalador (paths por poses), chucao, enjambre,
  partículas, viento (Path2D), niebla, lluvia, viñeta.
  `scene.birdPos` y `scene.swarmPos` los usa main para el hit-test del tap.
- `iconos.js` — SVG inline de la tienda: `ICONOS[id]` (uno por mejora, avance
  de savia y logro) + `ANT_SVG`/`SAP_SVG`/`TROFEO_SVG`. ViewBox 24, trazos
  redondeados `currentColor`, mismo lenguaje que la hormiga/gota del HUD. Sin
  imports (hoja).
- `ui.js` — HUD (escrituras DOM **solo cuando cambia el texto** — mantener),
  **tienda de pantalla completa** (como el ropero: `openShop()`/`closeShop()`)
  con tres solapas por icono — Hormigas (mejoras del modo activo), Savia
  (umbrales) y Trofeos (logros) — chips de moneda en el header, y **ropero de
  pantalla completa** (`openRopero()`/`closeRopero()`; export `menuAbierto()`
  que main usa para bloquear el salto con Espacio en ambos menús): maniquí en
  vivo (`drawProbador`
  por frame, objeto `probador` = lo que se prueba sin comprar), swatches de
  piel (aplican al toque), cartas con icono canvas (`drawCosmeticIcon`, una
  vez) y botón comprar/equipar/sacarse, toasts, `showBanner()`,
  `flash()`, chip de misión (abajo, entre tienda y mute, `pointer-events:
  none` — el tap pasa al canvas), clase `body.charging` que atenúa
  HUD/toasts/chip durante la carga (la zona de puntería queda limpia), mute
  (los SVG no tienen `.hidden`: usar `toggleAttribute`). Al pie de la solapa
  Trofeos vive el **rebirth** discreto (`#rebirth-btn`): dos toques para
  confirmar (`armarRebirth` muestra el preview de anillos a ganar /
  `desarmarRebirth`) → `carrera.volverAZona0()`, cuyo retorno arma el banner
  "+N anillos del monte". La solapa Trofeos también lista las estadísticas de
  vida (`#vida-stats`), con los anillos del monte y el bono de hormigas.
- `compartir.js` — comparte el récord como estampa xilográfica: `drawEstampa()`
  pinta una tarjeta 1080×1350 (noche/rama/nudos/savia/escalador con
  `drawFigure`+`idlePose`, récord = máx de zen/carrera) y `compartirRecord()`
  usa Web Share API con fallback a descarga PNG. Botón `#compartir-btn` en ui.
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

`manifest.json` + `sw.js` + `icons/`. Estrategia **network-first para la app
shell** (documento/JS/CSS: al recargar con conexión siempre traés la última
versión; el caché es solo respaldo offline) y **cache-first** para fuentes,
íconos e imágenes. El registro usa `updateViaCache:'none'` + `reg.update()` y
recarga UNA vez en `controllerchange` (solo si ya había un SW controlando), así
la actualización se ve sin reabrir la app — antes, cache-first dejaba pantalla
rancia aun recargando (pasaba en Brave iOS).
**REGLA: cualquier cambio en un asset requiere bumpear `CACHE`
(`rucacuero-vN`) en `sw.js`** o el respaldo offline queda viejo.
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

Branch de trabajo actual: `claude/game-construction-jh4fm3` (los branches de
iteraciones anteriores ya se mergearon a `main`). Commits en español,
descriptivos. No abrir PR salvo pedido explícito.

## Ideas pendientes (aprobadas a grandes rasgos, no comprometidas)

Ya entregado en iteraciones previas: rocío y granizo (climas que solo suman),
menos-movimiento (accesibilidad), compartir estampa (`compartir.js`), audio de
racha ascendente, estadísticas de vida en Trofeos, "El cuento del monte"
(misiones encadenadas con `state.cuento`), más logros (17) y el **prestige del
rebirth** (Anillos del monte).

Siguen abiertas:

- Más eventos de rama (siempre sin quitarle nada al jugador) y más logros.
- Darle a los **Anillos del monte** algo más que el bono de hormigas: un
  cosmético o desbloqueo que solo se consiga con prestige alto, o una segunda
  curva de anillos. (La base ya existe en `state.prestige`.)
- Compartir el récord como imagen animada; más modos de accesibilidad.
- Misiones encadenadas con más historia del monte (ampliar `CUENTO`).
