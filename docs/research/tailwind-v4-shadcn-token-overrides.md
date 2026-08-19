# Tailwind v4 + shadcn token override mechanics

Date: 2026-08-18
Status: Research notes for [#60](https://github.com/donmonty/bar-metrics/issues/60) (part of [#59](https://github.com/donmonty/bar-metrics/issues/59))

Investigated against primary sources only: the Tailwind CSS v4 docs, the
shadcn/ui docs, the shadcn registry's own JSON payloads, and the installed
package sources under `node_modules/`. Installed versions at time of writing
(`package.json` + `node_modules/*/package.json`):

| Package | Version |
| --- | --- |
| `tailwindcss` | 4.3.1 |
| `shadcn` (CLI) | 4.11.0 |
| `recharts` | 3.8.0 |
| `next` | 15.5.19 |

## Summary — actionable conclusions

1. **Every token value in `app/globals.css` came from the registry, not from
   us.** `:root` and `.dark` are byte-for-byte the shadcn `neutral` base
   colour payload, with exactly one hand edit (`--chart-1` in `:root`). The
   `@theme inline` block and the `@custom-variant dark` line are also CLI
   output. Nothing in `app/globals.css` is "ours" except that one value and
   its comment.
2. **`npx shadcn add <component>` will *not* clobber retuned token values.**
   The v4 CSS-var writer only *appends missing* declarations unless
   `overwriteCssVars` is true, and that flag is only true when a requested
   registry item is of type `registry:theme | registry:style | registry:font |
   registry:base`. A plain UI component (`registry:ui`) carries no `cssVars` at
   all. **`npx shadcn init` *will* clobber them** — it pulls the base-colour
   payload as a `registry:theme` item and overwrites every var it carries.
3. **The `:root` light block is 100% dead code today** and can be deleted. No
   SSR flash, no `prefers-color-scheme` path, no print path, no `color-scheme`
   dependency reads it. But **the `dark` class on `<html>` must stay** — eight
   `dark:` utilities in `components/ui/*` and `chart.tsx`'s `.dark [data-chart]`
   selector depend on it.
4. **Recommended dark-only shape: option (b′)** — keep `class="dark"` on
   `<html>`, move the dark values into `:root`, delete the `.dark` token block,
   and **add `color-scheme: dark`** (currently missing everywhere — form
   controls and scrollbars still render light-mode UA chrome).
5. **Per-bar ramp colouring is possible**, two ways, no `ChartContainer`
   changes needed. `<Cell>` children of `<Bar>` work in Recharts 3.8 but are
   **deprecated and removed in Recharts 4.0**. The non-deprecated equivalent is
   simpler: put a `fill` key on each data row. Both accept `var(--...)`.
6. **`base-nova` / `menuColor` / `menuAccent` inject no colour whatsoever.**
   `shadcn/tailwind.css` contains zero colour declarations. Nothing survives a
   token swap.

---

## 1. Authorship layers in `app/globals.css`

### 1.1 What is CLI-generated

**Everything structural.** The `shadcn` CLI ships a set of PostCSS plugins that
write into the file named by `components.json → tailwind.css`
(`app/globals.css` here). The v4 pipeline is assembled in one place — the
function bound to `mt` in `node_modules/shadcn/dist/index.js` (minified; the
readable landmark is the string `"update-css-vars-v4"`). For
`tailwindVersion === "v4"` the plugin list is rebuilt as:

```
o = [];
o.push(Vs({ params: "dark (&:is(.dark *))" }));   // postcssPlugin: "add-custom-variant"
o.push(Ns(t, { overwriteCssVars }));              // postcssPlugin: "update-css-vars-v4"
o.push(Os(t));                                    // postcssPlugin: "update-theme"
```

Mapping each plugin to what you see in `app/globals.css`:

| Plugin | Writes | Evidence |
| --- | --- | --- |
| `add-custom-variant` | `@custom-variant dark (&:is(.dark *));` — [app/globals.css:5](../../app/globals.css#L5) | The `params` string is a literal in the CLI. It only inserts if **no** `@custom-variant` at-rule exists anywhere in the file, and it inserts after the last `@import`. |
| `update-css-vars-v4` | The `:root` and `.dark` rule blocks — [app/globals.css:50-120](../../app/globals.css#L50) | `let i = n === "light" ? ":root" : ".".concat(n)` — the registry key `light` maps to `:root`, key `dark` maps to `.dark`. `theme` maps to `@theme`. |
| `update-theme` | The whole `@theme inline { ... }` block — [app/globals.css:7-48](../../app/globals.css#L7) | For every var seen in the payload whose value *looks like a colour*, it emits `--color-<name>: var(--<name>)`. The colour test is a helper (minified `Ms`) that returns true for values starting with `hsl`/`rgb`/`#`/`oklch`. Non-colour vars get `--<name>: var(--<name>)`. |
| `update-theme` (radius branch) | `--radius-sm` … `--radius-4xl` — [app/globals.css:41-47](../../app/globals.css#L41) | A hard-coded table `{ sm: "calc(var(--radius) * 0.6)", md: "calc(var(--radius) * 0.8)", lg: "var(--radius)", xl: "calc(var(--radius) * 1.4)", "2xl": … "4xl": "calc(var(--radius) * 2.6)" }` in the CLI, matching our file exactly. |
| `update-theme` (sidebar special case) | `--color-sidebar: var(--sidebar)` | Two explicit renames in the CLI: `--sidebar-background` → `--sidebar`, and `--color-sidebar-background` → `--color-sidebar`. |
| The registry style item | `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, and the whole `@layer base { * { @apply border-border outline-ring/50 } body { @apply bg-background text-foreground } }` block — [app/globals.css:2-3](../../app/globals.css#L2), [app/globals.css:122-131](../../app/globals.css#L122) | Verbatim from `https://ui.shadcn.com/r/styles/base-nova/index.json`, whose `css` key is exactly `{"@import \"tw-animate-css\"": {}, "@import \"shadcn/tailwind.css\"": {}, "@layer base": {"*": {"@apply border-border outline-ring/50": {}}, "body": {"@apply bg-background text-foreground": {}}}}`. |

### 1.2 What is authored by us

Diffing `app/globals.css` against `https://ui.shadcn.com/r/colors/neutral.json`
(`cssVarsV4.light` / `cssVarsV4.dark`), **every single token value matches the
registry** except:

- **`--chart-1: oklch(0.45 0 0)` in `:root`** — registry says `oklch(0.87 0 0)`.
  This is the hand edit, plus its explanatory comment at
  [app/globals.css:69-71](../../app/globals.css#L69).
- **`html { @apply font-sans }`** inside `@layer base`
  ([app/globals.css:129-131](../../app/globals.css#L129)) — not in the
  `base-nova` style item's `css` key. Ours.
- **`--font-heading` / `--font-sans`** at the top of `@theme inline` — written
  by the CLI's font handling (`registry:font` path), triggered by our
  `next/font` Geist setup in [app/layout.tsx:8](../../app/layout.tsx#L8).

Everything else — `:root` and `.dark` in full, the `@theme inline` mapping —
is regenerable output we happen to be storing in git.

### 1.3 What actually happens on a future CLI run

The decisive flag is `overwriteCssVars`. Both the `add` code paths compute it
identically:

```js
let l = o.cssVars ? (r.overwriteCssVars ?? (await So(e$1, t))) : void 0;
```

and `So` is:

```js
async function So(e, t) {
  let r = await qa$1(e, { config: t });
  return z.array(n).parse(r).some(
    (o) => o.type === "registry:theme" || o.type === "registry:style"
        || o.type === "registry:font"  || o.type === "registry:base",
  );
}
```

Inside `update-css-vars-v4`, the write is guarded on that flag — for both the
`@theme` branch and the `:root`/`.dark` branch the shape is the same:

```js
t.overwriteCssVars
  ? (p ? p.replaceWith(m) : s?.append(m))   // overwrite: replace existing decl
  : (p || s?.append(m))                     // default:   append ONLY if missing
```

So, concretely:

- **`npx shadcn add button` / `card` / `dialog` / any `registry:ui` item —
  safe.** Two independent reasons: (a) the fetched item has no `cssVars` at all
  (verified: `https://ui.shadcn.com/r/styles/base-nova/card.json` has no
  `cssVars` key), so `Jt`/`_a` bail early on `!Object.keys(e ?? {}).length`;
  and (b) even if it did, `overwriteCssVars` would be `false` for a
  `registry:ui` type, so existing declarations are left alone and only *new*
  var names are appended. **Our retuned values survive.**
- **`npx shadcn init` — destructive.** The base-colour palette is synthesised
  into a `registry:theme` item and unshifted onto the resolved item list
  whenever `"index"` is in play (i.e. an init):

  ```js
  if ((o.includes("index") || n$1.includes("index")) && t.tailwind.baseColor) {
    let g = await fl(t.tailwind.baseColor, t);   // -> { type: "registry:theme", cssVars: { theme, light, dark } }
    g && s.unshift(g);
  }
  ```

  (`node_modules/shadcn/dist/chunk-WI7CIZSS.js`; the synthesiser `fl` fetches
  `colors/${baseColor}.json` and, for v4, sets
  `light: { radius: "0.625rem", ...r.cssVarsV4.light }, dark: { ...r.cssVarsV4.dark }`.)
  Because the item type is `registry:theme`, `So` returns `true`,
  `overwriteCssVars` becomes `true`, and every `:root` / `.dark` declaration it
  carries is `replaceWith`-ed. **`--chart-1` and every retuned brand token
  would be reset to registry neutral.** The `/* chart-1 was … */` comment would
  survive (PostCSS comments aren't touched), leaving a comment that no longer
  describes the value below it.
- **`npx shadcn add <a theme/style/base/font item>`** — same destruction as
  init, for the vars that item carries.
- **Adding a *new* token of our own** (e.g. `--surface-2`) is safe under both
  paths: the CLI never removes declarations it doesn't recognise, it only
  appends or replaces by exact `--prop` name.
- **Deleting `.dark` is *not* stable under a re-init.** `update-css-vars-v4`
  recreates a missing selector via `r.append(s)` — i.e. **at the end of the
  file**. Since `:root` and `.dark` have identical specificity (see §2.2), a
  re-created `.dark` block appended after `:root` would silently win. Mitigation
  in §Recommendations.

**Practical guidance:** treat `app/globals.css` as ours, and treat
`shadcn init` as a destructive command that requires a `git diff` review after
running. `shadcn add` needs no ceremony.

> Docs cross-check: the shadcn theming docs describe the same layering — raw
> vars in `:root`/`.dark`, exposed to utilities via `@theme inline`
> (`--color-primary: var(--primary)`), and say chart tokens `--chart-1`…`-5`
> "live in your CSS file under `:root` and `.dark`". They do **not** document
> the overwrite semantics; that only comes from the installed CLI source.
> <https://ui.shadcn.com/docs/theming>

---

## 2. Dark-only shape

### 2.1 Why `@theme inline` matters here

Tailwind v4's `@theme` docs state that theme variables "must be defined
top-level and not nested under other selectors or media queries", and that
with the `inline` option "the utility class will use the theme variable *value*
instead of referencing the actual theme variable"
(<https://tailwindcss.com/docs/theme>).

This is exactly why the shadcn two-layer scheme works: `@theme inline` declares
`--color-background: var(--background)`, so the generated utility emits
`background-color: var(--background)` **literally** rather than
`var(--color-background)`. The `var(--background)` is then resolved *at the
element*, picking up whatever `--background` is inherited from the root. That's
what lets a plain re-declaration in `:root` or `.dark` re-skin every utility
with no rebuild of the theme layer. **Any re-skin should change values in
`:root`/`.dark` and leave `@theme inline` alone.**

### 2.2 Is the `:root` light block read by anything?

I checked every candidate path. **No.**

- **SSR / first paint.** `app/layout.tsx` renders
  `<html lang="en" className={cn("dark font-sans", geist.variable)}>`
  ([app/layout.tsx:17](../../app/layout.tsx#L17)). The class is in the
  server-rendered HTML string, present before the stylesheet is even parsed.
  There is no `next-themes`, no `ThemeProvider`, no `useTheme`, and no
  client-side class-flipping anywhere in `app/`, `components/`, `lib/`
  (grep: zero hits). There is therefore **no flash-of-light window at all** —
  unlike the `next-themes` setup the shadcn dark-mode docs describe, which is
  why those docs require `suppressHydrationWarning`
  (<https://ui.shadcn.com/docs/dark-mode/next>). We don't have that problem.
- **`prefers-color-scheme`.** Nothing in `app/globals.css` keys on it. The
  default Tailwind `dark` variant *would* use `prefers-color-scheme`
  (<https://tailwindcss.com/docs/dark-mode>), but line 5 replaces it with a
  class-based `@custom-variant`. So the media query is out of the picture
  entirely.
- **Print.** Zero `@media print` rules in the repo. Printing uses the same DOM
  and the same `.dark` class, so it resolves dark. (Note: browsers commonly
  drop backgrounds when printing, which is a separate legibility issue for a
  dark theme, but it is not a `:root`-block issue.)
- **`color-scheme`.** **Nothing sets it.** Not in `app/globals.css`, not
  anywhere in `app/` or `components/` (grep: zero hits), and **not in
  Tailwind's preflight** (`node_modules/tailwindcss/preflight.css` contains no
  `color-scheme` declaration). The initial value is `normal`
  (<https://www.w3.org/TR/css-color-adjust-1/>). This is a **real, currently
  live bug**, independent of the `:root` question: per that spec, the used
  colour scheme controls "the default colors of scrollbars and other
  interaction UI", "the default colors of form controls and other
  'specially-rendered' elements", and "on the root element … the surface color
  of the canvas, and the viewport's scrollbars". With `normal`, all of those
  render light — light scrollbars, light native `<select>` popups, light
  autofill backgrounds, light date pickers, and a white canvas behind an
  overscroll bounce. Given `components/ui/input.tsx`, `select.tsx` and
  `calendar.tsx` are all in play, fixing this belongs in the re-skin.
- **Specificity.** `:root` is a pseudo-class → specificity `(0,1,0)`. `.dark`
  is a class → `(0,1,0)`. They are **equal**, and both match the same `<html>`
  element. Source order decides, and `.dark` is written after `:root`, so
  `.dark` wins today. This is fragile-by-construction and is the main argument
  for collapsing to one block.
- **`components/ui/chart.tsx`.** `THEMES = { light: "", dark: ".dark" }`
  ([components/ui/chart.tsx:10](../../components/ui/chart.tsx#L10)) makes
  `ChartStyle` emit *two* rules per chart, ` [data-chart=X]` `(0,1,0)` and
  `.dark [data-chart=X]` `(0,2,0)`. The dark one wins. And in this repo every
  `ChartConfig` uses `color: "var(--chart-1)"` (not the `theme: {light, dark}`
  form) — see `ranked-bar-chart.tsx:72`, `sales-trend-chart.tsx:44`,
  `top-recetas-chart.tsx:46`, `merma-chart.tsx:50` — so both rules emit the
  *same* text, `--color-<key>: var(--chart-1)`, and the indirection resolves to
  whichever `--chart-1` is in scope. Charts are already dark-correct regardless
  of which block the values live in.

**Conclusion: yes, the `:root` light block can be deleted outright.** All 30
values in it are unreachable.

### 2.3 What `@custom-variant dark (&:is(.dark *))` implies

Two things worth stating plainly.

- **It targets descendants only.** `&:is(.dark *)` means "this element is a
  descendant of an element with `.dark`". The element carrying `.dark` — our
  `<html>` — does **not** match it. Today that's harmless because every styled
  element lives inside `<body>`. It would bite the moment someone puts a
  `dark:` utility directly on `<html>` (or on the `.dark` element in some
  future nested-theme scheme). Tailwind's own v4 docs recommend the
  self-inclusive form `@custom-variant dark (&:where(.dark, .dark *));`
  (<https://tailwindcss.com/docs/dark-mode>).
- **Don't change it as part of the re-skin.** `:is()` takes the specificity of
  its most specific argument, so `:is(.dark *)` adds `(0,1,0)` to every `dark:`
  utility; `:where()` adds `(0,0,0)`. Swapping `:is` → `:where` would *lower*
  the specificity of all eight existing `dark:` utilities in
  `components/ui/{button,input,select,calendar}.tsx` and could flip which
  declaration wins in pairs like `hover:bg-muted` vs `dark:hover:bg-input/50`.
  That's a separate, testable change; keep it out of a colour-only swap.
- **The variant is orthogonal to where token *values* live.** Deleting the
  `.dark` token *block* does not affect `dark:` utilities at all — those depend
  on the `dark` *class on `<html>`*, which stays. These two are frequently
  conflated; they are not the same thing.

### 2.4 The three options

**(a) Delete `.dark`, put dark values in `:root`, and remove the class from
`<html>`.**
❌ **Do not do this.** It breaks the eight `dark:` utilities baked into shadcn's
generated primitives — e.g.
`components/ui/input.tsx:12` has `dark:bg-input/30 dark:disabled:bg-input/80
dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40`,
and `components/ui/button.tsx:13` has
`dark:border-input dark:bg-input/30 dark:hover:bg-input/50`. These are
*intentional dark-mode refinements* (translucent input fills, softened
destructive rings), not fallbacks; without the class they simply stop applying
and the controls regress. It would also break `chart.tsx`'s `.dark
[data-chart]` rule. Any future `shadcn add` regenerates primitives containing
`dark:` classes, so this fights the tool forever.

**(b) Keep both blocks, `:root` holding the dark values.**
Robust but redundant: two copies of the same 30 values to keep in sync, and the
duplication invites drift. Its one merit is defence against the class being
accidentally lost.

**(b′) — recommended. Keep `class="dark"` on `<html>`; move the dark values
into `:root`; delete the `.dark` token block; add `color-scheme: dark`.**
One source of truth for values, no equal-specificity race, `dark:` utilities and
`.dark [data-chart]` keep working unchanged. Costs: a `shadcn init` would
re-append a `.dark` block at end-of-file that then wins (§1.3) — mitigate with
a comment in the file and a diff review after any init.

**(c) Status quo — keep both, hand-tune `.dark`.**
Works, but leaves 30 dead light values that (i) mislead every future reader
into thinking light mode is supported, (ii) are what the CLI's own style
detection reads (`hl`/`yl` in `index.js` infer `theme` and `chartColor` from
`rootVars["--primary"]` / `rootVars["--chart-1"]`, ignoring `.dark` unless they
agree), and (iii) get overwritten by a `shadcn init` anyway.

**Cost of reintroducing light mode later**, per option: (b′) costs the most —
you'd re-split `:root` into light values and re-add a `.dark` block, which is
mechanically ~10 minutes of moving values plus adding a theme provider. (c)
costs the least. Given #59 states light mode is "ruled out … committed to
hard", the clarity of (b′) is worth that trade.

---

## 3. Chart colour plumbing

### 3.1 How `ChartConfig` becomes `--color-<key>`

`ChartContainer` renders a `data-chart={chartId}` wrapper plus a `<ChartStyle>`
sibling ([components/ui/chart.tsx:62-81](../../components/ui/chart.tsx#L62)),
where `chartId` is `chart-${id ?? useId().replace(/:/g, "")}`.

`ChartStyle` ([components/ui/chart.tsx:84-115](../../components/ui/chart.tsx#L84))
filters the config to entries with a `theme` or `color`, then injects a raw
`<style>` tag via `dangerouslySetInnerHTML`. The mechanism, quoted:

```tsx
<style
  dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES)
      .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map(([key, itemConfig]) => {
  const color = itemConfig.theme?.[theme] ?? itemConfig.color
  return color ? `  --color-${key}: ${color};` : null
}).join("\n")}
}
`).join("\n"),
  }}
/>
```

With `THEMES = { light: "", dark: ".dark" }` this yields, for
`{ value: { label: "Valor", color: "var(--chart-1)" } }`:

```css
 [data-chart=chart-r1] { --color-value: var(--chart-1); }
.dark [data-chart=chart-r1] { --color-value: var(--chart-1); }
```

Chart elements then consume it as `fill="var(--color-value)"` —
[components/charts/ranked-bar-chart.tsx:109](../../components/charts/ranked-bar-chart.tsx#L109).
Note the double indirection: `--color-value` → `--chart-1` → whatever `:root`
or `.dark` last set. `var()` in an SVG presentation attribute resolves fine —
demonstrated by all four existing charts in this repo shipping exactly that.

### 3.2 Does it support more than one flat colour per series?

**No — by design.** `ChartConfig` is keyed by series/dataKey
([components/ui/chart.tsx:15-24](../../components/ui/chart.tsx#L15)) and each
entry carries at most one `color` (or one `{light, dark}` pair). There is no
per-datum concept anywhere in the file. **A ramp indexed by rank is not
expressible in `ChartConfig`.**

But that doesn't block us, because `ChartStyle` only *publishes CSS variables
into a scope*. Anything under `[data-chart=X]` can read them, and a Recharts
element can name any CSS var it likes. Two workable routes:

### 3.3 Route A — `<Cell>` (works; deprecated)

Confirmed working in the installed Recharts 3.8.0. `<Bar>` collects Cell
children and passes them into the rectangle selector:

```js
var cells = findAllByType(props.children, Cell);
var rects = useAppSelector(state => selectBarRectangles(state, props.id, isPanorama, cells));
```
(`node_modules/recharts/lib/cartesian/Bar.js:531-532`)

and `computeBarRectangles` merges the Cell's props onto each rectangle, **last**:

```js
var barRectangleItem = _objectSpread(_objectSpread({}, entry), {}, {
  stackedBarStart, x, y, width, height, value, payload: entry, background,
  tooltipPosition, parentViewBox, originalDataIndex: index
}, cells && cells[index] && cells[index].props);
```
(`node_modules/recharts/lib/cartesian/Bar.js:677-692`)

Cell itself is a pure marker — `var Cell = _props => null` with
`Cell.displayName = 'Cell'` (`node_modules/recharts/lib/component/Cell.js`).
The typed props are `SVGProps<SVGElement>` with `fill?: string` and
`stroke?: string` (`node_modules/recharts/types/component/Cell.d.ts`), so
`fill="var(--chart-ramp-3)"` is accepted and lands as the rect's `fill`
attribute.

Precedence is correct: the per-datum entry is spread **after** the Bar's own SVG
props when the rectangle renders —
`React.createElement(BarRectangle, _extends({}, baseProps, { name }, entry, {...}))`
(`node_modules/recharts/lib/cartesian/Bar.js:255` and `:281`) — so a Cell `fill`
beats `<Bar fill>`.

⚠️ **But it is deprecated.** The installed type declaration says so in-source:

> "This component is now deprecated and will be removed in Recharts 4.0. Please
> use the `shape` prop or `content` prop on the respective chart components to
> customize the rendering of chart elements instead of using `Cell`."
> — `node_modules/recharts/types/component/Cell.d.ts`

The official guide confirms and gives the reasons (react-is dependency;
context-dependent prop typing): <https://recharts.github.io/en-US/guide/cell/>.

### 3.4 Route B — per-datum `fill` on the data row (recommended)

Falls straight out of the same source line: `computeBarRectangles` spreads the
raw data `entry` into the rectangle *first*, and the rectangle render spreads
`entry` after `baseProps`. So a `fill` key on each data object becomes that
bar's fill, with no deprecated component involved and no extra children:

```tsx
const ramp = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
const rows = data.map((d, i) => ({ ...d, fill: ramp[Math.min(i, ramp.length - 1)] }))
// <Bar dataKey="value" radius={4} />   — no fill prop; each row supplies its own
```

This also plays well with `ChartTooltipContent`, which already prefers
`item.payload?.fill` when picking the swatch colour:
`const indicatorColor = color ?? item.payload?.fill ?? item.color`
([components/ui/chart.tsx:205](../../components/ui/chart.tsx#L205)). Route A
gets this for free too (Cell props are merged into the rectangle, and `payload`
is the entry), but Route B is the more direct match.

The fully future-proof third option is Recharts' `shape` prop —
`shape?: ActiveShape<BarShapeProps, SVGPathElement>`
(`node_modules/recharts/types/cartesian/Bar.d.ts:129`) — which is what the
deprecation guide points at. It's more code for no extra benefit here, so
prefer Route B unless per-bar geometry (not just colour) is needed.

**Answer to the ticket's question: yes, a ranked bar chart can step each bar
down an orange ramp.** Define the ramp as tokens (`--chart-1`…`-5`, or a
purpose-named set), and select per row.

### 3.5 One thing I could not determine

Whether the ramp should be exposed through `@theme inline` as
`--color-chart-*` utilities as well. `update-theme` would generate them on a
CLI run for any colour-valued var, but nothing in the repo consumes
`bg-chart-1`-style utilities today — charts only use `var()`. Left as a design
call for the palette ticket.

---

## 4. `base-nova` / `baseColor` / `menuColor` / `menuAccent`

**Verdict: none of these inject any colour at runtime. There is nothing to
conflict with a wholesale token swap.**

### 4.1 `shadcn/tailwind.css` — zero colour

`components.json` sets `"style": "base-nova"`, and the style item's `css` key
adds `@import "shadcn/tailwind.css"` to our file. That import resolves through
the package's `exports` map:

```json
"./tailwind.css": { "style": "./dist/tailwind.css" }
```

The whole file is 95 lines
(`node_modules/shadcn/dist/tailwind.css`) and contains, exhaustively:

- an `@theme inline` block holding **only** two `@keyframes`
  (`accordion-down`, `accordion-up`) — lines 1-25;
- nine `@custom-variant` declarations for Base UI / Radix data attributes
  (`data-open`, `data-closed`, `data-checked`, `data-unchecked`,
  `data-selected`, `data-disabled`, `data-active`, `data-horizontal`,
  `data-vertical`) — lines 27-86;
- one `@utility no-scrollbar` — lines 88-95.

**Not a single colour declaration.** Grep for `oklch|hsl|rgb|#` returns nothing.

### 4.2 `style: "base-nova"`

Two parts. `base-` is the base-UI prefix, stripped by the CLI
(`e.replace(/^(base|radix)-/, "")`); `nova` selects a preset from a hard-coded
table in `node_modules/shadcn/dist/index.js`:

```js
nova: { title: "Nova", description: "Lucide / Geist", style: "nova",
        baseColor: "neutral", theme: "neutral", chartColor: "neutral",
        iconLibrary: "lucide", font: "geist", fontHeading: "inherit",
        menuAccent: "subtle", menuColor: "default", radius: "default", rtl: false }
```

This is an **init-time defaults record**, not a runtime artifact. Confirmed by
fetching the style item itself: `https://ui.shadcn.com/r/styles/base-nova/index.json`
has `"cssVars": {}` and `"files": []`. Its only effect at add-time is choosing
which component-source directory the registry serves from
(`registry/base-nova/ui/card.tsx`, per `.../base-nova/card.json`).

### 4.3 `baseColor: "neutral"`

This one *is* colour-bearing, but only when `"index"` is being installed —
i.e. **only on init** (§1.3). It resolves to
`https://ui.shadcn.com/r/colors/neutral.json`, whose `cssVarsV4.light` /
`cssVarsV4.dark` are exactly what is sitting in our `:root` / `.dark` blocks
today. It is not consulted by `shadcn add <ui component>` for CSS purposes; on
that path it's only threaded into the *file* transform pipeline (`baseColor: l`
passed to the source-code transformer), which rewrites hard-coded colour class
names inside component source — irrelevant for v4 CSS-variable projects.

**Implication for the re-skin:** once we overwrite the values, `baseColor:
"neutral"` in `components.json` becomes a lie about the current palette but has
no live effect. Leaving it is fine; changing it to a non-registry value could
break a future init. Leave it, and put the truth in a comment in
`app/globals.css`.

### 4.4 `menuColor: "default"` / `menuAccent: "subtle"`

Purely init/scaffold parameters. In the CLI they are:

- fields on the preset table above;
- read back for the "detect current config" reporter (`fr` in `index.js`,
  which builds a preset code string);
- copied into `components.json` and forwarded as **URL query params** to the
  hosted init endpoint:
  ```js
  let r = new URLSearchParams({ base, style, baseColor, theme, iconLibrary,
                                font, rtl, menuAccent, menuColor, radius });
  return `${a}/init?${r.toString()}`;   // a === "https://ui.shadcn.com"
  ```

They change **which component source the registry generates** (e.g. whether a
menu item's highlight uses `bg-accent` or a bolder `bg-primary` treatment), and
that generated source lands in `components/ui/*.tsx` as ordinary Tailwind
classes referencing our semantic tokens. So their influence is already frozen
into the checked-in component files, expressed entirely in `bg-accent` /
`bg-muted` / `text-accent-foreground` terms. **Swap the tokens and they follow.**

Worth noting: this repo has no menu-family primitives installed at all
(`components/ui/` holds only button, calendar, card, chart, input, label,
popover, select, sheet, skeleton), so `menuColor`/`menuAccent` currently affect
nothing whatsoever.

---

## Recommendations for the re-skin

1. **Collapse to a single token block.** Move the dark values into `:root`,
   delete the `.dark` block, keep `className="dark"` on `<html>`
   ([app/layout.tsx:17](../../app/layout.tsx#L17)). Leave
   `@custom-variant dark (&:is(.dark *))` and the whole `@theme inline` block
   untouched.
2. **Add `color-scheme: dark` to `:root`.** Currently unset anywhere, so native
   scrollbars, `<select>` popups, autofill, and the `<Calendar>`/`<Input>`
   controls still paint light UA chrome on a near-black page. This is a live
   defect the re-skin should absorb.
   (<https://www.w3.org/TR/css-color-adjust-1/>)
3. **Leave `components.json` alone.** `style`, `baseColor`, `menuColor`,
   `menuAccent` inject no runtime colour. Changing `baseColor` buys nothing and
   risks a surprising init.
4. **Add a guard comment at the top of the token block**, e.g.
   `/* Hand-tuned brand palette. `npx shadcn init` OVERWRITES every value here
   (registry:theme => overwriteCssVars). `npx shadcn add <component>` does not.
   Review `git diff app/globals.css` after any init. */`
   This is the only available mitigation — the CLI offers no opt-out flag on
   the theme path.
5. **Colour ranked bars via a per-row `fill` key**, not `<Cell>` and not a
   `ChartConfig` change. Keep the ramp in CSS tokens so it stays swappable, and
   keep using `ChartConfig`/`ChartContainer` for the flat single-series charts
   exactly as today.
6. **Rewrite the stale conventions comment** in
   [components/charts/ranked-bar-chart.tsx:1-40](../../components/charts/ranked-bar-chart.tsx#L1)
   — it currently instructs readers that tokens are "deliberately
   low-saturation" and must clear contrast "against the white chart
   background", both of which become false. Same for `chart-layout.ts`.
   (Already tracked as an open item on #59.)
7. **Keep the `--chart-*` names.** They are what `update-theme` already maps
   into `@theme inline`; introducing parallel names would create tokens the CLI
   doesn't know about (harmless, but two conventions). If the ramp needs more
   than five steps, add `--chart-6`… and hand-add matching `--color-chart-6`
   entries to `@theme inline`; the CLI will not remove them.

## Open / undetermined

- Whether the orange ramp should also be exposed as Tailwind utilities
  (`bg-chart-3`) — see §3.5. No technical blocker either way.
- Print rendering of a dark-only theme (browsers dropping backgrounds) was not
  investigated beyond confirming the repo has no print styles; out of scope for
  #60 but a plausible follow-up if these dashboards get printed.
