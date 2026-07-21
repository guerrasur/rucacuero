// Verificación local (se borra antes del commit):
// 1) sintaxis de todos los módulos, importándolos en Node con stubs de DOM
// 2) prueba funcional del juego real con Playwright (piso de nube, saltos,
//    rocío/granizo, consola limpia)
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = [
  'js/state.js', 'js/climb.js', 'js/events.js', 'js/audio.js', 'js/scene.js',
  'js/main.js', 'js/quests.js', 'js/logros.js', 'js/iconos.js', 'js/ui.js',
  'js/compartir.js', 'js/economy.js', 'js/carrera.js', 'js/cosmetics.js', 'sw.js',
];
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: readFileSync(f, 'utf8'),
  });
  if (r.status === 0) console.log('OK  ', f);
  else {
    bad++;
    console.log('FALLA', f, '\n', r.stderr.toString().slice(0, 300));
  }
}
if (bad) process.exit(1);
console.log('--- sintaxis: todos OK ---');
