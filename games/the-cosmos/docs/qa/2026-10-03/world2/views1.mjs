import { open, landOccator, cam } from './lib.mjs';
const h = await open({ wait: 5000 }, 'v1');
await landOccator(h);
await h.page.evaluate(() => window.hideUI());
const dirs = await h.page.evaluate(() => {
  const b = window.cosmos.space.worlds.get('ceres').body, pi = b.padInfo;
  const az = (d) => { const e = d.x * pi.east.x + d.y * pi.east.y + d.z * pi.east.z, n = d.x * pi.north.x + d.y * pi.north.y + d.z * pi.north.z, u = d.x * pi.up.x + d.y * pi.up.y + d.z * pi.up.z; return { azDeg: Math.atan2(e, n) * 180 / Math.PI, elevDeg: Math.asin(u) * 180 / Math.PI }; };
  return { sun: az(b.sunDir) };
});
console.log(JSON.stringify(dirs));
const look = async (name, azDeg, elevDeg) => {
  await cam(h, [30, -140, 2], [30 + Math.sin(azDeg * Math.PI / 180) * 1000, -140 + Math.cos(azDeg * Math.PI / 180) * 1000, 2 + Math.tan(elevDeg * Math.PI / 180) * 1000], { ground: false, settle: 20 });
  await h.shot(name);
};
await look('sky-sun', dirs.sun.azDeg, dirs.sun.elevDeg);
await look('away-from-sun', dirs.sun.azDeg + 180, 8);
await look('side', dirs.sun.azDeg + 90, 8);
await h.browser.close();
