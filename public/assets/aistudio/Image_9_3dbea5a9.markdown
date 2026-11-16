---
name: StoryForge
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353942'
  surface-container-lowest: '#0a0e16'
  surface-container-low: '#181c24'
  surface-container: '#1c2028'
  surface-container-high: '#262a33'
  surface-container-highest: '#31353e'
  on-surface: '#dfe2ee'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#dfe2ee'
  inverse-on-surface: '#2c3039'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#c7c8ff'
  on-tertiary: '#1000a9'
  tertiary-container: '#a7a9ff'
  on-tertiary-container: '#2b29bb'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#0f131c'
  on-background: '#dfe2ee'
  surface-variant: '#31353e'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 36px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers a high-octane, cinematic creative studio tailored specifically for next-generation Roblox creators, viral shorts directors, and machinima storytellers. It balances the playful energy of modern metaverse gaming with the polished, frictionless workflow of high-end creative software. 

The aesthetic is **Cinematic Dark Neomorphism & Cyber-Glow**: deep, layered obsidian atmospheres that minimize eye fatigue during extended editing sessions, punctuated by electric cyber-amber and dimensional neon-cyan accents. The user interface feels tactile, focused, and responsive under the thumb, evoking the tactile excitement of a next-generation game engine console crossed with an intuitive social content studio.

## Colors

The palette establishes an immersive cinematic backdrop accented by high-energy gaming hues.

- **Primary (`#F59E0B` Electric Amber):** Drives key calls-to-action, generation progress triggers, and primary interactive highlights. Communicates power, creativity, and viral momentum.
- **Secondary (`#06B6D4` Cyber Cyan):** Utilized for AI generation state transitions, audio synthesis indicators, and secondary tags. Imparts high-tech precision.
- **Tertiary (`#6366F1` Roblox Violet):** Deployed for narrative flow links, character archetype tags, and subtle backdrop gradient orbs.
- **Neutral Canvas (`#0B0F17` Obsidian Void):** Base ground layer paired with tonal surface progressions (`#111827` base elevated, `#161F30` card containers, `#1F2C42` interactive active surfaces).
- **Text & Foreground:** High-legibility contrast using crisp `#F8FAFC` for headline titles, `#CBD5E1` for body copy, and `#64748B` for subdued metadata.

## Typography

Typography pairs the structural, geometric presence of **Plus Jakarta Sans** for titles, buttons, and navigation elements with the supreme utilitarian clarity of **Inter** for script bodies, story prompts, and analytical output.

- Scale headers tightly with tight tracking (`-0.02em` to `-0.03em`) on mobile viewports to prevent awkward word breaks in short-form screen sizes.
- Uppercase tracking is applied to `label-sm` (`+0.05em`) when denoting generation badges, character roles, or status indicators (e.g., `READY`, `GENERATING`).

## Layout & Spacing

The layout is built upon a mobile-first, vertical content rail model optimized for one-handed operation. 

- **Layout Structure:**
  - **Mobile (< 768px):** Single-column fluid view with a maximum width of `28rem` to `32rem` (`max-w-md`), centered horizontally with a fixed bottom navigation bar (`64px` height) and sticky top chrome (`56px` height). Bottom margins account for safe-area padding (`env(safe-area-inset-bottom) + 4rem`).
  - **Tablet (768px - 1024px):** 6-column grid with 1.25rem gutters, allowing side-by-side prompt controls and live stage previews.
  - **Desktop (>= 1024px):** 12-column grid constrained to `max-w-5xl` or `max-w-6xl` centered, transitioning bottom navigation to a compact persistent left sidebar dock or refined top header.
- **Rhythm & Touch:** Strict 4px base increments. All interactive components maintain touch target boundaries of at least 44px by 44px (with 48px standard for primary generative buttons).

## Elevation & Depth

Visual hierarchy uses **tonal layer stepping** paired with **diffused neon glow fields**, avoiding harsh drop shadows in favor of soft luminous depth.

- **Level 0 (Canvas):** Pure `#0B0F17` background with subtle multi-stop radial glows (`rgba(99, 102, 241, 0.08)` and `rgba(245, 158, 11, 0.05)`) positioned dynamically behind active generation zones.
- **Level 1 (Card & Content Blocks):** `#161F30` surface with a translucent border (`1px solid rgba(255, 255, 255, 0.06)`).
- **Level 2 (Floating Controls & Popovers):** `#1A2333` elevated surface with `box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(6, 182, 212, 0.1)`.
- **Level 3 (Primary Focus Elements / Generating State):** `#1F2C42` augmented by an outer electric amber glow (`0 0 20px rgba(245, 158, 11, 0.25)`).
- **Glass Surfaces:** Sticky top navigation bar and bottom tab bar utilize backdrop-filter blur (`16px`) over `rgba(11, 15, 23, 0.82)` with a bottom or top `1px` translucent edge line (`rgba(255, 255, 255, 0.08)`).

## Shapes

The design system employs **Rounded Level 2** (`0.5rem` / `8px` baseline) for micro-elements, scaling to `1rem` (`rounded-lg`) for interactive cards, and `1.5rem` (`rounded-2xl`) for outer generation panels and media preview modules. 

- Action pills and tag chips make full use of fully rounded geometry (`rounded-full`) to maintain an approachable, contemporary gaming interface aesthetic.
- Form inputs, sliders, and audio waveform containers share standard `rounded-lg` geometry to preserve structural continuity.

## Components

### Buttons
- **Primary Generator Button:** Full-width pill shape (`h-12`, `rounded-full`), gradient fill from `#F59E0B` to `#D97706`, text color `#0B0F17` (bold `label-lg`). Hover/active states project an amber rim glow. Includes an icon slot for generation sparkles or quick-dice roll.
- **Secondary / Action Buttons:** Dark surface (`#1F2C42`), border `1px solid rgba(255, 255, 255, 0.1)`, text `#F8FAFC`. Subtle hover shifts to `#26354D`.
- **Ghost / Icon Buttons:** Minimum 44x44px touch container, transparent base, active color shift with circular ripple.

### Chips & Filter Selectors
- **Horizontal Swipe Rail:** Edge-to-edge overflow scrolling container with hidden scrollbars and snap alignment.
- **State Styling:** Inactive chips use `#161F30` background with `#94A3B8` text. Selected chips transition to high-contrast cyan (`#06B6D4`) with dark text (`#0B0F17`) or electric amber outline with glowing indicator dots.

### Cards & Story Nodes
- **Story Scene Card:** Base `#161F30` with `rounded-xl` corners. Features thumbnail preview area (16:9 or 9:16 aspect ratio), metadata badges positioned top-left, and quick-action context buttons bottom-right.
- **Prompt Input Card:** Embedded surface with interior padding (`space-md`), integrating text area, voice-to-script toggle, and token cost indicators.

### Form Inputs & Text Areas
- **Input Fields:** `#111827` background, `1px solid rgba(255, 255, 255, 0.08)` border, focus ring in `#06B6D4` (`2px glow outline`). Placeholder text in `#475569`.
- **Checkboxes & Radios:** Rounded custom squares or circles (`20px`), solid `#06B6D4` checked fill with animated white mark icon.

### Navigation Bars
- **Sticky Top Bar:** Compact `56px` height. Displays the brand logomark on the left, generation credit pill badge in the center, and user avatar on the right.
- **Fixed Bottom Tab Bar:** `64px` height container hosting 4 core destinations (Home, Projects, Create, Settings). Active icons light up in `#F59E0B` accompanied by a micro glow underline; inactive icons rest at `#64748B`. The "Create" tab features an elevated center pill button.