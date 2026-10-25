# Design system

Generated with the community [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) skill
(`"education study tracker student mobile app" --design-system`), then adjusted for a Thai app.
Tokens live in `src/index.css` (`@theme`); components use the semantic classes, never raw hex or palette classes.

## Direction
- **Style:** Claymorphism — soft 3D cards (24px radius, white rim, double soft shadow), chunky buttons
  with a darker base that sinks on press (transform only, no layout shift).
- **Audience:** a ป.6 student on a phone, plus a parent. Friendly, encouraging, no jargon.
- **Light only:** the style lists dark mode as an anti-pattern.

## Color tokens
| Token | Hex | Use |
|---|---|---|
| `primary` | #4F46E5 | brand, active nav, secondary buttons |
| `accent` | #EA580C (black text) | **one** main action per screen (`btn-cta`) |
| `bg` / `card` | #EEF2FF / #FFFFFF | page / surfaces |
| `fg` / `muted-fg` | #1E1B4B / #475569 | text (≥ 4.5:1 everywhere) |
| `border` / `muted` | #C7D2FE / #EBEEF8 | outlines, tracks, ghost buttons |
| `success` `danger` `warning` (+ `-bg`) | #047857 #B91C1C #92400E | status text and filled ✓ ✗ buttons (white text ≥ 4.5:1) |

Subject colors stay as the categorical series (validated for color-blind separation; every use is labeled).

## Type
- Headings: **Mali** 600/700 (rounded, playful, has Thai). The tool suggested Baloo 2 + Comic Neue, which have no Thai glyphs.
- Body: **Sarabun** 400/600/700 — looped Thai like school textbooks. 16px base, line-height 1.6, nothing below 12px.

## Components (in `src/index.css` / `src/components/ui.tsx`)
`card`, `btn-primary`, `btn-cta`, `btn-ghost`, `chip` (uses `aria-pressed` for selected), `segmented` (tabs),
`input`, `label`, `PageTitle`, `CardTitle`, `Segmented`, `Toast`, `ProgressBar`, `Ring`.

## Rules
- Icons: lucide-react only, 2px stroke, sizes `ICON.sm/md/lg` = 16/20/24; decorative icons `aria-hidden`.
  Emoji only inside messages (🎉), never as UI icons.
- Touch targets ≥ 44px; 8px+ gaps. Tiny chart cells are display-only with button alternatives.
- Status never by color alone (glyph or text alongside).
- `:focus-visible` ring 3px; `prefers-reduced-motion` turns transitions off; safe-area insets on fixed/sticky bars.
- Motion: 100–150ms press/feedback, 300–500ms progress fills.
