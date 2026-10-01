# Economy and world save review — October 1, 2026

Changes are uncommitted for Claude. Work stays inside `games/the-cosmos/`; no space or ship flight files were edited. `main.js` contains small import, bootstrap, dispatch and frame integration blocks.

## What was exercised

- Hire Aoi through the real Talk/Hire panel: 400 marks charged. The Loft model walks the ramp and route, sits at the comms station and gives channel/account reports. All six crew routes also pass the existing collision checks.
- Talk back and forth with a trader; buy and sell food. A 390×844 touch context buys water. All catalog goods, dealer stock, money transfers and item masses are checked in the validator.
- Dig real bucket loads; sell one tonne at the depot for 12 marks. Ride the elevator to the supervisor, accept the foundation quest, deliver one tonne at the marked bay and receive 400 marks once. The remaining load survives refresh. Delivered lots remain accounted for; unexplained mass and volume are both zero.
- Pour another dug load into a real heap. Refresh preserves the edited bricks and pile record. The before/after hash of all edited float32 distance samples is identical. Unit checks also compare saved dig/pour samples and material density bit for bit.
- Fire real F-key shots from the ventral seat: impacts become durable damage actions. Refresh restores those records, the deliberately damaged hull, the moved existing ship, the occupied pilot seat, hired comms officer, purse, quest result and cargo. The ship relocation uses the existing debug hook; sustained flight was left to the other builder.
- Open the touch Controls panel and use G. Every advertised key has a touch path; the validator scans UI literals for unmapped prompts. The phone panel's 18 controls are at least 44×44 pixels, with no horizontal page overflow. Settings and contextual buttons remain available too.

## Evidence

Final full validator: **392 passed, 0 failed**. Run `node test/validate.mjs` from the game folder. The complete output is [validation.txt](validation.txt). Reproduce the browser walkthrough with port 8394 running and `node docs/qa/2026-10-01/economy/browser.mjs`. The script uses the repository's existing Playwright/Chromium installation because `agent-browser` is unavailable on PATH.

[browser-results.json](browser-results.json) contains assertions, measured account/cargo values, before/after terrain hashes and browser errors. The successful walkthrough reports no page errors. Screenshots were opened and visually reviewed:

- [Comms hire](02-comms-hire.png), [comms at station](03-comms-at-station.png)
- [Trader dialogue](04-trader-conversation.png), [buy/sell](05-trader-buy-sell.png), [depot weigh-in](07-depot-weigh-in.png)
- [Dug ground](06-dug-hole.png), [poured heap](14-spoil-heap.png)
- [Accepted tower quest](08-tower-quest-accepted.png), [marked delivery bay](09-marked-delivery-bay.png), [refreshed aboard](10-refreshed-aboard.png)
- [Phone arrival](11-phone-arrival.png), [phone controls/G](12-phone-controls-debug.png), [phone trade](13-phone-trade.png)

Desktop and phone both use `?tier=low&depth=16`; the depth request is emulated on Chromium's native 24-bit buffer. Screenshots exposed an initial Controls/Games overlap and a phone HUD/purse overlap; both were corrected and the walkthrough rerun. Early walkthrough failures also corrected the test's supervisor approach, insufficient delivery load and an unsafe wait predicate. Review teleports now force terrain rebuilds before pictures; an early heap picture had stale ground-patch gaps because the test skipped that step. The retained JSON and screenshots are from the final successful run.

## Limits

This is local IndexedDB persistence, not shared multiplayer. Important actions save atomically; wait for **Saved locally** before treating them as durable. A hard crash can lose an unfinished write or recent movement. The server ownership, reconnect and cost plan is [WORLD-STATE.md](../../../WORLD-STATE.md).

Wage boundaries, insolvency and replacement fees were exercised in accelerated rules tests, not by waiting a real Mars sol in the browser. The local sol clock pauses while the world is closed. Saved shot scars do not deform terrain. NPC flight orders, live drone HP/projectiles and respawn timers are not restored yet. Goods are tradable inventory; ammo/oxygen consumption is not connected to flight/combat. Physical iPhone/Android rendering speed, large multi-day digging saves, server crashes and real two-player synchronization were not verified here. Claude's independent picture review remains to be done.
