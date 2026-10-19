# Admin pages: house rule

Applies to every page under `/admin/` (Steering, Control Room, Sapling, and anything new).

1. **Back link.** Every admin/control page has a back link to its parent at the very top
   ("&larr; Steering" for pages directly under `/admin/`). Min 44px tall.
2. **Tabs once it grows.** When a page has more than ~3 sections, split it into tabs.
   - One tab's content visible at a time; the first tab is the default.
   - The chosen tab lives in the URL hash (`#talk`, `#rules`...) so back, refresh and shared links keep it.
     Listen to `hashchange`; unknown hash = default tab.
   - Max ~6 tabs. Group related sections; name tabs with one plain word.
   - Tabs are big enough to tap (min 44px tall), sit in a row that scrolls horizontally if it doesn't fit,
     and never cause sideways page scroll.
3. **Phone first.** iPhone Safari is the target. Check in WebKit at iPhone size: every tab switches, no console
   errors, `document.documentElement.scrollWidth == innerWidth`.
4. **Match the page's look** (Sapling warm brown/cream, Control and Steering dark).
5. Build new admin pages this way from the start; reference implementations: `admin/sapling/index.html` (static
   tabs) and `admin/control/index.html` (tabs generated from data).
