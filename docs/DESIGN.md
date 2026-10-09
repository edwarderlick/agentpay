# AgentPay design tokens

Preserved from the Stitch export `autonomous_kinetic_editorial/DESIGN.md`.
The app reads these colors and type roles through `frontend/app/globals.css`.
Stitch HTML/PNG exports were removed after the screens were implemented in `app/frontend`.
---
name: Autonomous Kinetic Editorial
colors:
  surface: '#fdf9f0'
  surface-dim: '#dddad1'
  surface-bright: '#fdf9f0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3ea'
  surface-container: '#f1eee5'
  surface-container-high: '#ece8df'
  surface-container-highest: '#e6e2d9'
  on-surface: '#1c1c17'
  on-surface-variant: '#424843'
  inverse-surface: '#31312b'
  inverse-on-surface: '#f4f0e7'
  outline: '#737973'
  outline-variant: '#c2c8c2'
  surface-tint: '#4d6355'
  primary: '#02150a'
  on-primary: '#ffffff'
  primary-container: '#152a1e'
  on-primary-container: '#7b9282'
  inverse-primary: '#b4cdbb'
  secondary: '#a63500'
  on-secondary: '#ffffff'
  secondary-container: '#d04400'
  on-secondary-container: '#fffbff'
  tertiary: '#0c1300'
  on-tertiary: '#ffffff'
  tertiary-container: '#1f2900'
  on-tertiary-container: '#7b9725'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e9d6'
  primary-fixed-dim: '#b4cdbb'
  on-primary-fixed: '#0a2014'
  on-primary-fixed-variant: '#364c3e'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59c'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#822700'
  tertiary-fixed: '#cfef74'
  tertiary-fixed-dim: '#b4d25b'
  on-tertiary-fixed: '#161f00'
  on-tertiary-fixed-variant: '#3c4d00'
  background: '#fdf9f0'
  on-background: '#1c1c17'
  surface-variant: '#e6e2d9'
typography:
  display-xl:
    fontFamily: Space Grotesk
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 76px
    letterSpacing: -0.04em
  display-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  metric-display:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-tag:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 3rem
---

## Brand & Style

This design system blends high-density Swiss editorial discipline with web3 infrastructural precision for intelligent agent commerce. Built to bridge human treasury oversight with GenLayer Studio Nextâ€™s consensus-driven agent payments (Chain ID 61997), the aesthetic commands authority, velocity, and institutional trust without succumbing to generic SaaS tropes.

The visual style is **High-Contrast Editorial Structuralism**. It combines deep, dense surfaces (deep forest canopy, obsidian, warm archival parchment) punctuated by electric safety orange and playful neon-tinted pastel micro-cards. It leverages modular stepped grids, architectural 1px linear partitions, highlighted sticker badges, and oversized display type that asserts machine-speed settlement and high financial confidence.

## Colors

The palette establishes an immediate tension between archival stability and hyper-modern telemetry. 

- **Primary Canvas & Solid Inks**: Grounded in `#152A1E` (Deep Forest) and `#102418` (Darkest Spruce), paired against `#FBF7EE` (Warm Editorial Cream) and `#F4EFEA` (Card Stone).
- **Primary Energy / Action**: `#FF5500` (Vivid Safety Orange), demanding immediate focus for execution CTAs, key protocol state changes, transaction confirmations, and active toggles.
- **Micro-Card Pastel Accents**: Expressive semantic tokens derived directly from the editorial reference:
  - Lime Chartreuse (`#D4F478`): Active agent state, optimistic consensus, live balances.
  - Soft Rose (`#FFA6C9`): Gas reserves, security thresholds, agent validation tags.
  - Canary Yellow (`#FED766`): Multi-sig requirements, pending batch operations.
  - Cyan Ice (`#7DE2D1`): Smart contract endpoints, Chain ID 61997 execution routes.
- **Base Typography & Grids**: `#111111` for crisp headlines and primary copy; `#E5E0D4` for razor-sharp 1px structural grid separators.

## Typography

The type system mirrors high-end broadsheet publishing fused with Web3 terminal precision:

1. **Display & Headlines (`Space Grotesk`)**: Tightly kerned, dense, and unapologetically massive. Line-height is locked close to font size to mirror editorial mastheads. High-impact headlines frequently incorporate inline floating pill badges.
2. **Body (`Hanken Grotesk`)**: Pragmatic, ultra-legible, human yet objective. Used for operational explanations, payment conditions, and client metadata.
3. **Labels & Telemetry (`JetBrains Mono`)**: Strict monospace formatting for contract hashes, Chain ID metrics (`61997`), numerical indices `[01]`, gas limits, and uppercase category flags.

## Layout & Spacing

Layout adheres to an uncompromising, architectural 12-column grid defined by explicit 1px baseline boundaries and interlocking masonry units.

- **Desktop (12 Columns)**: Max container width of 1440px with full-bleed colored background sections (`#152A1E`, `#FF5500`, `#FBF7EE`). Grids alternate between asymmetric hero layouts (offset imagery with pixel-cutout accents) and 4-column KPI metric ribbons divided by hairline borders.
- **Stepped & Overlapping Blocks**: Content blocks deliberately break traditional horizontal containmentâ€”such as deep forest cards overlapping hero photography and pastel colored service panels staggered diagonally.
- **Mobile (4 Columns)**: Reflows seamlessly into full-width stacked blocks. Metric counters stack in 2x2 grids with 1px dividers intact. Monospace indices sit pinned directly above titles.

## Elevation & Depth

This system outright rejects muddy drop shadows and faux blur diffusion. Depth is communicated strictly via **Tonal Layering and Hard Architectural Outlines**:

- **Zero Drop-Shadow Rule**: Surfaces rely on extreme color juxtaposition rather than drop shadows. Floating panels utilize crisp 1px borders (`#111111` or `#152A1E`) or sharp contrast shifts against the cream `#FBF7EE` backdrop.
- **Sticker / Tape Annotation Layering**: Micro-pill annotations (`Your Security`, `Beyond Risk`, `Chain 61997`) render with solid fills (`#FFA6C9`, `#FED766`, `#FF5500`), rotating slightly (-2deg to +3deg) and overlapping headline glyphs at a high z-index.
- **Pixel Grid Accent Insets**: Card edges and photography frequently use inverted stepped corner cutouts or solid geometric notch badges to signify machine-level authenticity.

## Shapes

The primary shape philosophy is **Geometric Sharp (`0`)**. 

- **Panels, Cards, and Inputs**: Render with exact `0px` border-radius, maintaining hard, razor-sharp architectural corners.
- **Exception for Pills & Annotation Badges**: Capsule badges, interactive CTA arrow tags, and floating micro-chips utilize `rounded-full` (`9999px`) to create an intentional structural tension against the monolithic, square container cards.

## Components

### Buttons
- **Primary Action (White on Dark / Dark on Cream)**: High-contrast rectangular blocks or rounded pills containing bold text accompanied by an inline right arrow (`â†’`). Example: White rounded pill (`#FFFFFF`) with dark forest text (`#152A1E`) hovering to safety orange (`#FF5500`).
- **Icon Action Buttons**: Sharp square buttons (`48px x 48px`) in vivid safety orange or deep green featuring centered 45Â° diagonal arrow icons for navigation or linkouts.

### Metric Tiles (Data Ribbons)
- Horizontally distributed, bordered by hairline 1px borders (`#E5E0D4`). Each tile presents an oversized metric value (`6K+`, `81%`, `61997 ID`) in Space Grotesk above a small, neutral, uppercase label.

### Pastel Bento Cards
- Distinct monochrome and pastel cards (`#FFA6C9`, `#D4F478`, `#FED766`, `#7DE2D1`, `#FFFFFF`) featuring:
  - Top-left iconography / status avatar.
  - Top-right monospace index (e.g., `01`, `02`).
  - Heavy black bold Space Grotesk headline.
  - Descriptive metadata in dark Hanken Grotesk.

### Accordion & Service Rows
- Full-width stacked bands separated by 1px dividers. Inactive rows present clean, stark black typography with diagonal arrow indicators; active states expand into rich `#152A1E` or `#FF5500` backgrounds with white body text and inverse arrow buttons.

### Form Inputs
- Stark architectural text boxes with transparent or `#102418` dark surfaces, high-contrast placeholder text, zero border-radius, and embedded inline submit pills (e.g., "Subscribe â†’" or "Execute â†’").
