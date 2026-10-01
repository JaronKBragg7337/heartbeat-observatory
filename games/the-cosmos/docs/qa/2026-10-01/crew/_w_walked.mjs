// WALKED: the real input pipeline. W held on the keyboard walks the player from the Meridian's ramp to the crew by the board, T talks,
// the dialog's own buttons hire and order. Nothing here calls the crew API directly except to read state back.
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'w';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  const where = () => page.evaluate(() => { const c = window.cosmos; const l = c.port.site.toLocal(c.walker.worldPos); return `(${l.x.toFixed(1)}, ${l.z.toFixed(1)})`; });
  // spawn is (-10, 38) facing the ramp. Turn to face the hiring board (south-west): yaw so that "north" of the walker points at (-18, 44)
  await page.evaluate(() => { const c = window.cosmos; c.view.mode = 'third'; const w = c.walker; const f = w.updateFrame(); const t = c.port.site.toWorld(-17.5, 0.0, 42.0); const d = { x: t.x - w.worldPos.x, y: t.y - w.worldPos.y, z: t.z - w.worldPos.z }; const dn = d.x * f.north.x + d.y * f.north.y + d.z * f.north.z, de = d.x * f.east.x + d.y * f.east.y + d.z * f.east.z; w.yaw = Math.atan2(de, dn); });
  console.log('start', await where());
  await shot(pre + '_01_start_third_person');
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500);
    const near = await page.evaluate(() => { const c = window.cosmos; return !!c.crew.nearest(c.walker.worldPos); });
    if (near) break;
  }
  await page.keyboard.up('KeyW');
  console.log('after walking', await where());
  await page.waitForTimeout(500);
  const btn = await page.evaluate(() => { const b = document.getElementById('crew-talk'); return [b.style.display, b.textContent]; });
  console.log('talk button', JSON.stringify(btn));
  await shot(pre + '_02_walked_up_talk_button');
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(400);
  await shot(pre + '_03_pressed_T_panel');
  await page.click('[data-a="hire"]');
  await page.waitForTimeout(600);
  console.log('hired?', await page.evaluate(() => [...window.cosmos.crew.members.values()].map(m => m.name + ':' + m.status).join(' ')));
  await shot(pre + '_04_hired_she_says');
  // watch her go: real time, a few seconds at a time, from the player's own view
  await page.evaluate(() => { const c = window.cosmos; const w = c.walker; const f = w.updateFrame(); const t = c.port.site.toWorld(0, 0, 30); const d = { x: t.x - w.worldPos.x, y: t.y - w.worldPos.y, z: t.z - w.worldPos.z }; w.yaw = Math.atan2(d.x * f.east.x + d.y * f.east.y + d.z * f.east.z, d.x * f.north.x + d.y * f.north.y + d.z * f.north.z); });
  await page.waitForTimeout(6000);
  await shot(pre + '_05_pilot_walking_to_the_ramp');
  await page.waitForTimeout(20000);
  await shot(pre + '_06_pilot_a_few_seconds_later');
  console.log('pilot', await page.evaluate(() => { const m = window.cosmos.crew.members.get('pilot'); return `${m.place}/${m.mode} fps ${window.cosmos.engine.fps.toFixed(1)}`; }));
  await browser.close();
};
