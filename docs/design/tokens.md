# หนี้ชัด design tokens

Source of truth: `src/app/globals.css`. This file records the values and why they were chosen.

## Direction

**Scene.** A recent graduate stands at a bank counter or on a BTS platform in daylight, phone in one hand and a paper slip in the other. They have just paid this month's กยศ. instalment and want to record it and see the balance move. That points to a light theme, high contrast, big touch targets, and nothing decorative.

**Idea: teller's stamp ink on white.** The only colour in the interface is the cobalt of a bank counter's "ชำระแล้ว" rubber stamp. That ink marks every primary action, the selected nav item and focus rings. Everything else is a cool neutral tinted slightly toward the same hue. The page background is pure white, like a receipt. The calm comes from having little on screen, not from muted pastels.

**Colour strategy:** Restrained. Tinted neutrals plus one accent covering ≤10% of any screen. Semantic colours (success, warning, destructive) appear only for state.

**The one bold element:** the balance figure (`MoneyText size="xl"`): 40px semibold tabular numerals with a half-size muted `บาท`. Everything around it stays quiet.

## Palette (light, the primary theme)

| Token | OKLCH | Hex | Use | Contrast |
|---|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `#ffffff` | page, cards, popovers; also `viewport.themeColor` | n/a |
| `--foreground` | `oklch(0.21 0.025 255)` | `#101924` | body text, headings | 17.7:1 on bg |
| `--primary` | `oklch(0.45 0.123 250)` | `#085796` | stamp ink: primary buttons, active nav, links, ring | 7.4:1 on bg |
| `--primary-foreground` | `oklch(0.985 0.003 250)` | `#f9fafc` | text on primary | 7.1:1 |
| `--secondary` | `oklch(0.955 0.014 250)` | `#e9f1f9` | secondary buttons | n/a |
| `--secondary-foreground` | `oklch(0.32 0.07 250)` | `#133555` | text on secondary | n/a |
| `--muted` | `oklch(0.965 0.006 250)` | `#f0f4f7` | second neutral layer: empty states, quiet panels | n/a |
| `--muted-foreground` | `oklch(0.48 0.02 255)` | `#565e69` | secondary text, `บาท` unit, inactive nav | 6.5:1 on bg, 5.9:1 on muted |
| `--accent` | `oklch(0.945 0.025 250)` | `#e1effd` | selected/hover tint (active-nav pill) | n/a |
| `--accent-foreground` | `oklch(0.38 0.1 250)` | `#0a4475` | text on accent | 8.5:1 |
| `--border` | `oklch(0.91 0.008 250)` | `#dde2e6` | hairlines, dividers | n/a |
| `--input` | `oklch(0.66 0.016 250)` | `#8b939c` | form-control borders | 3.1:1 (WCAG 1.4.11) |
| `--ring` | = primary | `#085796` | focus ring (used at 50%) | n/a |
| `--destructive` | `oklch(0.53 0.19 27)` | `#c22826` | errors, void | 5.8:1 on bg |
| `--success` | `oklch(0.5 0.12 155)` | `#0b7643` | verified / paid state | 5.7:1 on bg |
| `--warning` | `oklch(0.56 0.12 65)` | `#a46311` | needs-attention state | 4.8:1 on bg |

Charts use a ramp of the ink hue (`--chart-1..3`) plus success and warning.

### Dark tokens (`.dark`)

These are defined so the `ui/*` components work under a `.dark` class. Nothing switches them on yet; that waits until a `ThemeProvider` from `next-themes` is added.

| Token | OKLCH | Hex |
|---|---|---|
| `--background` | `oklch(0.17 0.015 255)` | `#0b1016` |
| `--card` / `--popover` | `oklch(0.21 0.018 255)` | `#131921` |
| `--foreground` | `oklch(0.95 0.008 250)` | `#ebeff4` (16.5:1) |
| `--primary` | `oklch(0.72 0.12 250)` | `#67aaed` (7.8:1) |
| `--primary-foreground` | `oklch(0.17 0.03 255)` | `#06101c` |
| `--muted` / `--secondary` | `oklch(0.25 0.018 255)` | `#1c222a` |
| `--muted-foreground` | `oklch(0.72 0.02 255)` | `#9ca5b1` (7.7:1) |
| `--accent` | `oklch(0.28 0.04 250)` | `#192a3c` |
| `--accent-foreground` | `oklch(0.85 0.06 250)` | `#b1d2f4` |
| `--destructive` | `oklch(0.68 0.18 25)` | `#f3625d` |
| `--success` | `oklch(0.72 0.13 155)` | `#57bc80` |

## Typography

- **Family:** IBM Plex Sans Thai (400/500/600/700) via `next/font`, exposed as `--font-sans`. Fallbacks: Noto Sans Thai, Leelawadee UI, Thonburi, then system-ui. One family covers everything. It has a matching Latin design and clear Thai loops, and the digits are tabular when `tabular-nums` is set.
- **Scale:** fixed rem values at a ~1.2 ratio on a 16px base. These override Tailwind's `text-*` sizes. Line-heights are taller than a Latin-only scale because Thai places vowels and tone marks above and below the line.

| Utility | Size | Line-height | Role |
|---|---|---|---|
| `text-xs` | 13px | 1.45 | bottom-nav labels, captions |
| `text-sm` | 14px | 1.55 | secondary text, labels, errors |
| `text-base` | 16px | 1.65 | body, inputs (16px stops iOS from zooming on focus) |
| `text-lg` | 19px | 1.5 | list emphasis |
| `text-xl` | 23px | 1.4 | page titles (`PageHeader`) |
| `text-2xl` | 28px | 1.3 | `MoneyText lg`, sub-screen headings |
| `text-3xl` | 33px | 1.25 | wordmark on login |
| `text-4xl` | 40px | 1.15 | `MoneyText xl` (balance), tracking −0.02em |

- Weights: 400 body, 500 labels, 600 headings, buttons and figures, 700 only for the wordmark.
- `text-wrap: balance` on h1–h3 and `pretty` on paragraphs.

## Spacing and layout

- 4px base unit (Tailwind default). The page gutter is 16px (`px-4`). Groups inside a section are 8–16px apart and sections are 20–24px apart.
- Content column is `max-w-md` (448px), centred. Phones use the full width.
- Touch targets are at least 44px: back button 44px, inputs and buttons 48px, the primary action 56px, nav cells 64px tall.
- Safe areas: `viewportFit: 'cover'`, with `env(safe-area-inset-*)` on the top padding, the bottom nav and the floating primary action. Full-height screens use `100dvh` (`min-h-dvh`).
- Thumb zone: the bottom nav, the floating primary action and the login form's input and submit button all sit in the lower half of the screen.
- `body { overflow-x: clip }` acts as a backstop against horizontal scroll at 390px.

## Radius

`--radius: 0.75rem`. Larger radii go on larger objects so the shapes show hierarchy:

| Utility | Value | Used for |
|---|---|---|
| `rounded-md` | ~10px | default shadcn controls |
| `rounded-lg` | 12px | login input and button |
| `rounded-xl` | ~17px | primary action button, empty state, cards |
| `rounded-full` | pill | active-nav indicator, icon buttons |

## Elevation

Shadows are tinted with the ink or foreground hue, never a flat grey.

- `shadow-raised` (`--elevation-raised`): a subtle lift for cards that need it.
- `shadow-float` (`--elevation-float`): only the floating primary action, which is the one element that sits above content.
- The bottom nav uses a solid background and a hairline top border, with no blur and no shadow.

## Z-index

`z-30` floating primary action, then `z-40` bottom nav, then `z-50` dialogs and overlays (shadcn default), then the toaster.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out-quart` / default easing | `cubic-bezier(0.25, 1, 0.5, 1)` | all transitions |
| fast | 150ms | press feedback (`active:scale-[0.98]` on the primary action) |
| default | 200ms | colour and state changes (nav pill, hovers) |
| slow | 250ms | dialog and sheet enter/exit (tw-animate-css) |

Motion only conveys state: press, selection and open/close. There are no page-load sequences. `prefers-reduced-motion: reduce` collapses all animations and transitions to effectively instant.
