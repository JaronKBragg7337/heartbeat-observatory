// page-side helpers for the crew QA scripts
export const SIM = `
window.__sim = (seconds, dt = 1 / 30) => { const e = window.cosmos.engine; const n = Math.round(seconds / dt); for (let i = 0; i < n; i++) { e.timeSec += dt; for (const fn of e._updaters) fn(dt, e.timeSec); } };
window.__cam = (eye, target) => { const c = window.cosmos; c.freeCam.set(eye, target); for (let i = 0; i < 3; i++) c.step(1 / 60); };
// ship-local point to world
window.__sl = (x, y, z) => window.cosmos.ship.flight.toWorld({ x, y, z });
window.__pl = (x, y, z) => window.cosmos.port.site.toWorld(x, y, z);
true`;
