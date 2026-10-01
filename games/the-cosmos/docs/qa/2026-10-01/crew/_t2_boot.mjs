export default async ({ launch }) => {
  const h = await launch({ w: 750, h: 470 });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 }).catch(() => console.log('crew never built'));
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const c = window.cosmos, cr = c.crew;
    if (!cr) return 'no crew';
    return [...cr.members.values()].map(m => [m.name, m.person.loaded, JSON.stringify(m.gpos)].join(' '));
  });
  console.log(JSON.stringify(info));
  await page.evaluate(() => { const c = window.cosmos; c.view.mode = 'third'; for (let i = 0; i < 20; i++) c.step(1/30); });
  await shot('t2_boot_third');
  await browser.close();
};
