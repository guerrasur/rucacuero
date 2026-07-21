// Iconos SVG inline de la tienda: uno por mejora, avance de savia y logro,
// más los de las solapas. Mismo lenguaje que la hormiga y la gota del HUD:
// viewBox 24, trazos redondeados en currentColor, formas planas de xilografía.

const svg = inner =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

export const ANT_SVG = svg(
  '<ellipse cx="12" cy="17" rx="3.2" ry="2.5" fill="currentColor"/><circle cx="12" cy="11.8" r="1.9" fill="currentColor"/><circle cx="12" cy="7.6" r="2.5" fill="currentColor"/><path d="M10.7 5.9 9.2 3.8M13.3 5.9 14.8 3.8M9.9 12l-3-1M14.1 12l3-1M9.7 16l-2.9 1.5M14.3 16l2.9 1.5M10.2 18.8 8.4 21.2M13.8 18.8 15.6 21.2"/>'
);

export const SAP_SVG = svg(
  '<path d="M12 3c3 4.4 5.8 7.6 5.8 10.8a5.8 5.8 0 0 1-11.6 0C6.2 10.6 9 7.4 12 3z" fill="currentColor" stroke="none"/>'
);

export const TROFEO_SVG = svg(
  '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z" fill="currentColor"/><path d="M8 5H4.5c0 3.2 1.6 4.8 3.5 4.8M16 5h3.5c0 3.2-1.6 4.8-3.5 4.8M12 13.5V16"/><path d="M8.5 19.5c0-1.9 1.5-3.2 3.5-3.2s3.5 1.3 3.5 3.2z" fill="currentColor"/>'
);

export const ICONOS = {
  // ---- mejoras de hormigas negras (zen) ----
  feromonas: svg(
    '<path d="M4 19.5c5 0 3-6.5 8-6.5s3-8.5 8-8.5" stroke-dasharray="3 3.4"/><circle cx="4" cy="19.5" r="1.7" fill="currentColor" stroke="none"/><circle cx="20" cy="4.5" r="1.7" fill="currentColor" stroke="none"/>'
  ),
  reina: svg(
    '<path d="M5 16 4 7.5l4.5 3L12 5l3.5 5.5 4.5-3L19 16z" fill="currentColor"/><path d="M6.5 19.5h11"/>'
  ),
  nudos: svg(
    '<circle cx="12" cy="12" r="5.5"/><path d="M12 12a3 3 0 1 1 3 3"/><path d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.8 5.8l1.5 1.5M18.2 5.8l-1.5 1.5M5.8 18.2l1.5-1.5M18.2 18.2l-1.5-1.5"/>'
  ),
  mielada: svg(
    '<path d="M5 4c7-1 12 2.5 13.5 8-6 1.2-11.5-.5-13.5-8z" fill="currentColor"/><path d="M8.5 16.5c.9 1.4 1.5 2.3 1.5 3.1a1.6 1.6 0 0 1-3.2 0c0-.8.7-1.7 1.7-3.1z" fill="currentColor" stroke="none"/><path d="M14.5 15.5c.9 1.4 1.5 2.3 1.5 3.1a1.6 1.6 0 0 1-3.2 0c0-.8.7-1.7 1.7-3.1z" fill="currentColor" stroke="none"/>'
  ),
  ofrenda: svg(
    '<path d="M4.5 13.5h15c0 3.5-3 6.5-7.5 6.5s-7.5-3-7.5-6.5z" fill="currentColor"/><path d="M12 3.5c1.6 2.3 3 4 3 5.6a3 3 0 0 1-6 0c0-1.6 1.4-3.3 3-5.6z"/>'
  ),

  // ---- mejoras de hormigas coloradas (carrera) ----
  resorte: svg(
    '<path d="M6.5 20.5h7M7 20l6-2.4-6-2.4 6-2.4-6-2.4 6-2.4-6-2.4"/><path d="M17.5 13V4.5M14.5 7.5l3-3 3 3"/>'
  ),
  reloj: svg(
    '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.2 3 5.3 4 8.5 1-3.2 4-4.3 4-8.5M8 20.5c0-4.2 3-5.3 4-8.5 1 3.2 4 4.3 4 8.5"/><circle cx="12" cy="17.5" r="1.4" fill="currentColor" stroke="none"/>'
  ),
  eco: svg(
    '<circle cx="8" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12.5 8.5a5 5 0 0 1 0 7M16 5.5a9.5 9.5 0 0 1 0 13"/>'
  ),
  botin: svg(
    '<path d="M9.5 7.5 8 4h8l-1.5 3.5"/><path d="M9.5 7.5h5c3 2 4.5 4.5 4.5 7 0 3-2.5 5-7 5s-7-2-7-5c0-2.5 1.5-5 4.5-7z" fill="currentColor"/>'
  ),

  // ---- avances de savia ----
  resina: svg(
    '<path d="M3.5 6h17"/><path d="M12 8c2 2.8 3.6 4.9 3.6 6.9a3.6 3.6 0 0 1-7.2 0C8.4 12.9 10 10.8 12 8z" fill="currentColor" stroke="none"/>'
  ),
  viento: svg(
    '<path d="M3.5 9h10a2.5 2.5 0 1 0-2.5-2.5M3.5 14h13a2.5 2.5 0 1 1-2.5 2.5"/>'
  ),
  saltolargo: svg(
    '<circle cx="5.5" cy="17.5" r="2"/><circle cx="18.5" cy="17.5" r="2"/><path d="M5.5 13C7.5 7 16.5 7 18.5 12.5"/><path d="m15.9 11.1 2.6 1.4 1.3-2.5"/>'
  ),
  brisa: svg(
    '<path d="M12 3.5 19 6v6c0 4.5-3 7.6-7 8.7-4-1.1-7-4.2-7-8.7V6z"/><path d="M8.5 11.5c1.2-1.1 2.3 1.1 3.5 0s2.3 1.1 3.5 0M8.5 15c1.2-1.1 2.3 1.1 3.5 0s2.3 1.1 3.5 0"/>'
  ),

  // ---- logros ----
  metros100: svg(
    '<path d="M7 3.5v17"/><path d="M7 4.5h10l-3 3.5 3 3.5H7z" fill="currentColor"/>'
  ),
  metros1000: svg(
    '<path d="M3.5 19.5 10 8l4 6.5 2.5-3.5 4 8.5z" fill="currentColor"/><path d="M10 8V4.5M10 4.5h3.5L12.2 6l1.3 1.5H10"/>'
  ),
  metros5000: svg(
    '<path d="M3.5 20 9.5 10l3.5 5.5 2-2.8 5.5 7.3z" fill="currentColor"/><path d="M15.5 3a3.4 3.4 0 1 0 4 4.6A3.4 3.4 0 0 1 15.5 3z" fill="currentColor"/>'
  ),
  perfectos25: svg(
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'
  ),
  perfectos150: svg(
    '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>'
  ),
  chucaos10: svg(
    '<circle cx="15" cy="7.5" r="2.6" fill="currentColor"/><path d="M8 13.5c0-3 2.5-5.2 5.7-5.2 2.6 0 4.8 2 4.8 4.6 0 3.2-2.7 5.3-6.3 5.3H9z" fill="currentColor"/><path d="m8.5 14-5 3.7 5.3-.7"/><path d="m17.6 6.7 3.2.8-3.2.9"/><path d="M11.5 18.3v2.4M14 18.3v2.4"/>'
  ),
  enjambres5: svg(
    '<circle cx="12" cy="13" r="2.2" fill="currentColor" stroke="none"/><path d="M12 8.7V6.9M12 19.1v-1.8M7.7 13H5.9M18.1 13h-1.8M8.9 9.9 7.6 8.6M16.4 17.4 15.1 16.1M15.1 9.9l1.3-1.3M7.6 17.4l1.3-1.3"/><circle cx="5.5" cy="5" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="20" r="1.3" fill="currentColor" stroke="none"/>'
  ),
  lluvias5: svg(
    '<path d="M6.8 13a4 4 0 0 1 .7-7.9A4.6 4.6 0 0 1 16 5.4 3.9 3.9 0 0 1 17.3 13z" fill="currentColor"/><path d="m8 16-1.2 3.2M12.5 16l-1.2 3.2M17 16l-1.2 3.2"/>'
  ),
  gastadas5000: svg(
    '<ellipse cx="12" cy="6.5" rx="6.5" ry="2.8" fill="currentColor"/><path d="M5.5 6.5v5.5c0 1.6 2.9 2.9 6.5 2.9s6.5-1.3 6.5-2.9V6.5"/><path d="M5.5 12v5.5c0 1.6 2.9 2.9 6.5 2.9s6.5-1.3 6.5-2.9V12"/>'
  ),
  record180: svg(
    '<path d="M19 4.5C10 4.5 5.5 9.5 5 19.5c9.5-.5 14-5.5 14-15z"/><path d="M8 16.5c2-4 5-7 8.5-8.5"/>'
  ),
  record260: svg(
    '<path d="M13 3a5.5 5.5 0 1 0 6.5 7.5A5.5 5.5 0 0 1 13 3z" fill="currentColor"/><path d="M3.5 20h17"/>'
  ),
  misiones25: svg(
    '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><path d="m9 12 2.2 2.2L15 10"/>'
  ),
};

// la mejora y el avance "mielada" comparten hoja: mismo dibujo, un solo lugar
export function icono(id) {
  return ICONOS[id] || '';
}
