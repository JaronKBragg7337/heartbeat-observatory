# World 2 shops and jobs: how to add one (no code)

Everything here is data in **`world2/shops.json`**. Add a row, bump the three version stamps (below), and the city
gives the shop a storefront, a sign, an OPEN sign on the door and an interior. Jaron or any AI can do it.

**The rule that never bends:** Heartbeat Observatory never sells food, water or land, and nothing in World 2 costs
real money. Shops take **beats**, which are play money: earned at the jobs, kept in a ledger on the device, never
bought, sold or cashed out. Food shops are atmosphere. Keep the word "pretend" on anything edible.

## Add a shop

Add one object to `"shops"`:

```json
{ "name": "MOONLIGHT COMICS", "kind": "comics", "keeper": "Zed", "hello": "New issues are on the wall.",
  "sells": [{ "item": "a comic book", "price": 3 }] }
```

| field | what it does |
|---|---|
| `name` | The sign over the door (capitals read best; about 22 letters fit). Required. |
| `kind` | Which preset dresses the inside. One of the names under `"kinds"`. Unknown or missing = a plain general store. |
| `street`, `cross` | Ask for a street: `"street": "Calhoun St", "cross": "Berry St"` puts it on Calhoun as near Berry as a storefront allows. A shop with a street appears once. |
| `max` | Most copies of this shop in town. Without it the city may open a second one, far from the first, once every shop has a storefront. |
| `keeper`, `hello` | The shopkeeper's name and what they say when you walk in. |
| `sells` | `[{ "item": "...", "price": 3 }]`. The first item is sold at the register for that many beats. |
| `menu` | Up to six lines for the chalkboard, each ending in its price: `"Latte 3"`. |
| `link` | `{ "label": "Play the games", "path": "/games/" }` hangs a poster in the shop that opens that page of the site. This is the first world's rule: things inside a building go somewhere. |
| `job` | The id of a job that is worked here (see below). |
| `map` | `true` puts the shop on the place map. Job sites are on it already. |
| `sign` | `{ "bg": "#1f3b2d", "fg": "#f2e3b3", "serif": true }` to choose the sign's colours. |
| `wall`, `accent`, `floor`, `goods`, `back`, `props`, `center` | Override the kind for this one shop. |

How the city places shops: every storefront the building kit draws gets a row. Rows that ask for a street go first,
then every other row gets one storefront, then the leftovers get second locations as far from the first as possible.
Storefronts the kit drew with dark windows stay empty and read FOR LEASE. Today: 64 rows, 114 shops, 5 for lease.
Shop signs live in one texture that grows by one row of pixels per four shops (about 0.35 MB each row).

## Add a kind

A kind is a preset under `"kinds"`. It picks one of three layouts and says what goes in it:

```json
"comics": { "layout": "retail", "floor": "wood", "wall": "#2a3350", "accent": "#e8b020",
            "goods": ["mags", "books", "mags"], "center": "bins", "back": ["toys"], "icon": "library" }
```

- `layout`: `"cafe"` (counter service and seating), `"retail"` (wall shelves and a centre piece) or `"service"` (work stations along a wall).
- `floor`: `wood`, `tile`, `check` or `concrete`. `wall` and `accent` are colours. `"dark": true` for a low-lit room.
- `goods`: what the wall shelves hold, in order. `back`: what the shelf behind the counter holds.
  Styles: `books records mags boxes cans paint bottles jars bags cups plates folded shoes toys cameras radios plants vases bread yarn tools keys clocks guitars`.
- `center` (retail, and service if set): `gondola table bins racks bikes buckets bench crates telescopes`, or `none`.
- `props` (cafe): `espresso pastry taps oven tubs breadrack grill`. `seating`: any of `tables booths stools`.
- `stations` (service): `barber washers nails sewing printers workbench teller`.
- `icon`: the place-map icon (`store diner library music arcade post`).

A new layout, a new goods style or a new prop is code: `world2/shops.js` (`stock()` for goods, the layout blocks in
`buildShop()`). Keep a shop under 30 draw calls and 60k triangles; today the heaviest is about 20k.

## Add or tune a job

Jobs are under `"jobs"`. Three kinds exist:

- `"orders"`: customers ask for something from `menu`; each menu line is a list of `steps`, and each step is a station
  from `stations` (id: label). In a shop, the stations stand along the back shelf of the shop whose row says
  `"job": "<id>"` (station ids the kit has a prop for: `cup espresso milk water choc tea`; any other id gets a labelled box).
  `"at": "NEWSSTAND"` runs it at the street kiosk instead (ids: `news sports comics puzzles`).
  `seconds` is the shift, `pay` per order, `tip` extra when served within `tipUnder` seconds.
- `"courier"`: `runs` deliveries between shop doors, `pay` each, `bonus` when on time; the clock is the street distance
  times `secondsPerMeter`, plus `slack` seconds.
- `"usher"`: `seconds`, `pay` per guest seated in the right seat of the Grand Palace.

The currency's name is `"currency"` (`name`, `one`). The line printed in the ledger and on every shop's notice is `"policy"`.

## After editing

1. Check the file parses: `python -c "import json;json.load(open('world2/shops.json',encoding='utf-8'))"`.
2. Bump the stamp **in all of these, same commit** (browsers cache by it): `BUILD` and the four `?v=` imports at the top
   of `world2/main.js`, the `city.js?v=` import in `world2/life.js`, and `main.js?v=` in `world2/index.html`.
   `shops.json` is fetched with `?v=BUILD`, so it rides along.
3. Run `node test3.cjs phone shops` (in `AI-Shared/scratch/world2-remake/phase3/scripts/`): it walks into and out of
   every shop and checks the budget.
