// Node 24 resolves the browser's import-map name to the same vendored Three.
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'three') return { url: new URL('../lib/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}});
