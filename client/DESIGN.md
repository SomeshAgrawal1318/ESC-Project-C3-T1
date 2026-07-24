# LexiPath Design System

The visual language for the LexiPath client. This is the **authoritative spec** — approved by the
project owner in July 2026 after three review passes on a live sample board. Any UI work (human or
AI agent) must follow it. If you change something here, change it deliberately and update this file.

Brand source of truth: `../lexipath_brand_assets_v2/` (`brand-tokens.json`, logo SVGs). This doc
derives from it; the brand kit always wins over anything invented.

---

## 1. The one-paragraph brief

LexiPath helps educators/therapists review AI-flagged spelling errors in children's handwritten
work. The UI is a **navy "ink" sidebar** anchoring a **warm paper content area** (scans must sit on
a light neutral ground). The signature motif is **ruled exercise-book paper** — the paper children
write on. Detailing is **gently squared** (sheets of paper, not app bubbles), statuses are written
like a **teacher's margin annotation**, and the one big curve allowed anywhere is the **bowl
corner** taken from the LP logo.

## 2. Hard rules (things the owner explicitly rejected — do not reintroduce)

1. **No capsule/pill status badges** (rounded box + colored dot). Rejected as "cliché, AI-like".
   Status is a *margin note* — see §6.
2. **No large all-corner border radii.** Radii live in the 4–8px range (cards 6px). The owner
   found >10px "too curved" and 2–3px "too squared up". 4–8px is the settled dial.
3. **Cards must never blend into the background.** White cards on the off-white paper need a firm
   border (`#d9d2c0`) *and* a real shadow (see §5). Hairline-border-only cards were rejected.
4. **Sage never carries white text** — it fails contrast. Navy (`--ink`) is the primary action
   color; sage is accent only (active nav, margin lines, hover borders, eyebrows via
   `--sage-strong`).
5. **Content column always centers**: `max-width` + `margin-inline: auto`. Never a left-pinned
   column with dead space on wide monitors.
6. **Lexend only.** One typeface, roles differentiated by weight/size/tracking (§4). No second
   font family.

## 3. Color tokens

Defined in `src/index.css` on `:root`. Use the CSS variables, never raw hex, in component styles.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1A2433` | Sidebar bg (gradient start), primary buttons, headings/body text |
| `--ink-soft` | `#2C384A` | Primary button hover |
| `--ink-deep` | `#131B27` | Sidebar gradient end |
| `--sage` | `#7B8F7A` | Accent: active-nav inset edge, hover borders, motif margin line |
| `--sage-strong` | `#566B55` | Sage that passes text contrast on paper — eyebrows, icons on light |
| `--mist` | `#D6D4CC` | Quiet rules |
| `--paper` | `#F7F5EF` | Content-area background |
| `--surface` | `#FFFFFF` | Card faces |
| `--border` / `--border-strong` | `#E7E3D9` / `#D3CDBD` | Quiet vs emphasized edges |
| card border | `#d9d2c0` | The firm card edge (between border and border-strong) |
| `--muted` | `#5C665E` | Secondary text |
| `--done` / `--pending` / `--failed` | `#4F6B4E` / `#8A6314` / `#A23A26` | Status inks — **annotation color only, never a fill** |

Navy-shell (sidebar) counterparts — light-on-dark:

```css
--shell-text: #f2f0e9;
--shell-muted: #98a1ae;
--shell-line: rgba(247, 245, 239, 0.12);   /* borders on navy */
--shell-hover: rgba(247, 245, 239, 0.07);
--shell-active-bg: rgba(123, 143, 122, 0.24);  /* sage-tinted active nav */
--shell-active-text: #cdd8cc;
```

Reading-comfort mode (`:root[data-comfort='on']`, toggled by `ComfortContext`) warms
`--paper/--surface/--band-bg` and widens line-height/tracking. The navy sidebar is intentionally
unaffected. Never hardcode a paper tone a comfort override can't reach — route it through a token.

## 4. Typography

Lexend variable (300–700), loaded via Google Fonts in `index.html`. Fallback `Inter, system-ui, Arial`.

| Role | Spec |
|---|---|
| Display / page titles | 500, `clamp(28px, 3.6vw, 40px)`, line-height 1.05, letter-spacing −0.01em |
| Section titles | 500, 21–22px |
| Body | 400 (300 for supporting/muted lines), 16px, line-height 1.55 |
| **Eyebrow** | 600, 12px, letter-spacing +0.14em, UPPERCASE, color `--sage-strong` |
| Status margin note | 600, 11px, letter-spacing +0.13em, UPPERCASE, status ink |
| Emphasis | 500–600. Avoid 700 for UI chrome — it renders chunky in Lexend |

## 5. Geometry & elevation

- Radii: **cards/rows 6px, buttons/inputs 5px, small chips 4px, band/empty-state 8px**. Nothing
  else. Never round all four corners of anything beyond 8px.
- **Bowl corner** — the ownable device. One rounded upper-right corner mirroring the sage bowl of
  the LP mark, applied ONLY to identity blocks (avatars, sample thumbnails, empty-state mark):
  `border-radius: 5px 20px 5px 5px;` (44px avatar) · `4px 16px 4px 4px` (60×50 thumbnail).
- Card elevation (resting): `border: 1px solid #d9d2c0;`
  `box-shadow: 0 1px 3px rgba(26,36,51,0.07), 0 12px 26px -12px rgba(26,36,51,0.22);`
- Card hover: `border-color: var(--sage);`
  `box-shadow: 0 2px 4px rgba(26,36,51,0.07), 0 18px 34px -14px rgba(26,36,51,0.3);`
- Primary button: navy fill, white text, crisp inner keyline instead of a glow:
  `box-shadow: inset 0 0 0 1px rgba(247,245,239,0.18);`
- Disabled/locked actions: transparent bg, `1.5px dashed var(--border-strong)` — visible but
  clearly inert (locked features stay discoverable, never hidden).

## 6. Status = margin note (chosen treatment "A")

A teacher's annotation, not a badge:

```css
.status-note {            /* tone class adds --st */
  position: relative; display: inline-flex; align-items: baseline;
  padding: 0 3px 7px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.13em;
  text-transform: uppercase; color: var(--st);
}
.status-note::after {     /* the slightly hand-set underline */
  content: ''; position: absolute; left: 0; right: 2px; bottom: 2px;
  height: 2px; background: currentColor; opacity: 0.5;
  transform: rotate(-1.2deg);
}
.status-note--done { --st: var(--done); }
.status-note--pending { --st: var(--pending); }
.status-note--failed { --st: var(--failed); }
```

Tone selection stays in `src/lib/status.js` (`statusFor()` maps both backend vocabularies).
The component is `src/components/StatusPill.jsx` (rename to `StatusNote` when convenient).

## 7. Ruled exercise-book motif

Faint handwriting-practice baselines + one vertical sage margin line. **Allowed in exactly three
places** — page-header band, empty state, sample thumbnails. Do not add a fourth without updating
this doc.

```css
/* band / empty state (30px rule pitch, washed back with a white veil) */
background:
  linear-gradient(0deg, rgba(255,255,255,0.55), rgba(255,255,255,0.55)),
  repeating-linear-gradient(180deg, transparent 0 30px, rgba(26,36,51,0.1) 30px 31px);
background-color: var(--band-bg); /* #fbf9f3, comfort-mode aware */
/* sage margin line = absolutely positioned ::before, 2px wide,
   left: 56px on the band (content padding-left: 84px) */

/* thumbnail (9px pitch, margin line at left: 12px) */
background:
  repeating-linear-gradient(180deg, transparent 0 9px, rgba(26,36,51,0.12) 9px 10px),
  #fdfcf8;
```

Empty state: same ruled ground + `1.5px dashed` border, 8px radius — "a fresh page waiting for
writing", with the single primary action in it.

## 8. Layout

- Shell: CSS grid `var(--sidebar-w) 1fr` (sidebar 248px), `min-height: 100svh`.
- Sidebar: `linear-gradient(178deg, var(--ink) 0%, var(--ink-deep) 100%)`, sticky full-height;
  order: brand (white-variant logo + wordmark) → comfort toggle → nav → therapist card pinned to
  the bottom (`margin-top: auto`).
  - Active nav item: `background: var(--shell-active-bg); color: var(--shell-active-text);
    box-shadow: inset 2.5px 0 0 var(--sage);`
  - Focus rings on the dark shell need a light outline (`--shell-active-text`), not the default sage.
- Content: `width: 100%; max-width: 1200px; margin-inline: auto;
  padding: clamp(22px, 4vw, 48px) clamp(18px, 4vw, 52px) 56px;` — this is what makes the app fit
  any monitor. Never remove the centering.
- Breakpoints: `≤1024px` sidebar narrows (200px, tighter padding); `≤760px` shell collapses to a
  single column — sidebar becomes a wrapping top bar (row direction, comfort toggle full-width
  last, therapist pushed right), band loses its margin line and left padding.

## 9. Page header pattern (every screen starts like this)

```
[eyebrow — sage caps]        e.g. STUDENT PROFILE / CASELOAD
[page title — Lexend 500]    e.g. Wei Jie Lim
[meta chip]                  e.g. PRIMARY 4 (squared chip, 4px radius)
[actions row, right-aligned] primary + secondaries, wraps under title on narrow screens
```

On the student profile the whole header sits on the ruled **band** (§7). On list pages
(My students) it's plain, with the **search input** right-aligned in the same header row:
white surface, `#d9d2c0` border, 5px radius, 44px min-height, sage-strong search icon,
placeholder "Search students by name…", filters the grid client-side as you type.

## 10. Copy voice

- Sentence case everywhere except eyebrows/status notes (which are structural caps).
- Buttons say exactly what happens: "Upload writing sample", not "Submit".
- Empty states invite the next action and mention the child by first name where natural.
- Locked features explain their unlock: "Available once a sample has been analysed."
- Never auto-correct or paraphrase a child's written words in any UI string — display `written`
  verbatim (product invariant, see `../CLAUDE.md`).

## 11. File map

| Concern | File |
|---|---|
| Tokens, reset, base type, comfort mode | `src/index.css` |
| All component/page styles (flat BEM-ish classes) | `src/App.css` |
| Shell (sidebar + routed outlet) | `src/App.jsx`, `src/components/Sidebar.jsx` |
| Logo (brand + `variant="light"` for navy shell) | `src/components/Logo.jsx` |
| Buttons / status / icons / rows / empty state | `src/components/*.jsx` |
| Status vocabulary mapping | `src/lib/status.js` |
| Live rendered reference of all of the above | `/styleguide` route (`src/pages/StyleguidePage.jsx`) |

No CSS frameworks, no icon libraries, no new dependencies — inline SVG icons via
`src/components/Icon.jsx` (1.8 stroke, round caps).

## 12. Adding a new screen (checklist)

1. Page component in `src/pages/`, route in `src/main.jsx`, data via functions in `src/lib/api.js`
   (mirror `server/paths.txt`; mocks in `src/lib/mockData.js` until the backend exists).
2. Start with the header pattern (§9); put it on the band only if the screen is about one
   student's work.
3. Cards per §5, statuses per §6, motif only per §7.
4. Check at 1920 / 1366 / 800 / 390px — centered column, top-bar collapse, no horizontal scroll.
5. Add the new pieces to `/styleguide` if they introduce a reusable pattern.
