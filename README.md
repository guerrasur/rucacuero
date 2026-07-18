# Ruca Cuero

Alpha jugable de un juego web mobile-first: un escalador sube una rama gigante
verde, de noche, con el viento en contra.

## Jugar

Es HTML/CSS/JS vanilla, sin build ni dependencias. Servir la carpeta estática:

```sh
python3 -m http.server 8000
# abrir http://localhost:8000 (idealmente en un celular o con viewport móvil)
```

## Cómo se juega

- **Mantené presionado** la pantalla para cargar el salto; una marca sube por la
  rama mostrando dónde vas a caer. **Soltá** cuando la marca esté sobre el
  siguiente nudo (la banda ámbar es la zona segura).
- Quedarte corto o pasarte = resbalón y pérdida de altura. Aun con un salto
  limpio hay una probabilidad base de resbalar por **mala suerte**, que se
  reduce comprando *Nudos reforzados*.
- Cuando sopla el **viento** (los trazos que cruzan la pantalla), la zona
  segura se angosta.
- La rama cambia con la altura: cada **zona** (Corteza baja, Corteza pelada,
  Copa ventosa, Rama joven, Cielo de hojas) tiene su propio verde, distancia
  entre nudos, savia y frecuencia de ráfagas. La rama lleva marcas pintadas
  cada 10 m y un banderín ámbar en tu récord.
- Sonido procedural con WebAudio (sin assets): golpe de agarre, resbalón,
  ráfagas de ruido filtrado, carga del salto y campanitas de desbloqueo.
  Se silencia con el botón de abajo a la derecha (persistente).
- **Eventos raros** (nunca le quitan nada al jugador): un **chucao** se posa
  en el borde de la rama — tocarlo lo espanta y suelta semillas que dan un
  bono de hormigas; y **lluvia**, que duplica la savia mientras dura pero
  vuelve la corteza más resbalosa.
- **Misiones cortas** rotativas (chip bajo el récord): rachas de agarres,
  saltos perfectos, metros ganados, compras, agarres con ráfaga o espantar
  al chucao. Recompensan hormigas y sus objetivos escalan al completarlas.

## Tres capas de progreso

| Capa | Cómo avanza | Se pierde |
|---|---|---|
| **Hormigas** | Solas, en tiempo real, solo con el juego abierto | Se gastan en mejoras |
| **Altura** | Manual, saltando de nudo en nudo | Solo por fallo de habilidad o mala suerte |
| **Savia** | Sola, constante, solo con el juego abierto | Nunca — cada umbral desbloquea una mejora permanente |

Todo el estado (hormigas, savia, altura, récord, mejoras, desbloqueos) persiste
en `localStorage` (clave `rucacuero_save_v1`). No se simula tiempo offline: al
reabrir se continúa exactamente desde el valor guardado.

## Dirección visual

"Xilografía nocturna": formas planas saturadas con contornos gruesos de tinta,
noche de monte donde la savia ámbar es la única luz cálida, y el viento
dibujado como trazos de grabado. Paleta: Noche de Monte `#131B12`, Verde Cuero
`#7FA636`, Musgo Hondo `#43601F`, Savia `#F0A32A`, Hueso `#F2E8CE`, Tinta de
Hormiga `#2A1C14`. Tipografías: Chango (display) + Bricolage Grotesque (texto).
