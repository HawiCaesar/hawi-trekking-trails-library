---
name: Hawi's Hikes
description: A personal trail archive as a vintage outdoor magazine — warm paper, bold type, and each hike published like a trip story.
colors:
  paper: "#f5f1eb"
  paper-dark: "#1c1916"
  ink: "#1a1816"
  ink-dark: "#f5f1eb"
  accent: "#2d4a3e"
  accent-hover: "#1f352b"
  accent-muted: "#4a6b5a"
  accent-surface: "#e8f0ec"
  accent-surface-dark: "#14231c"
  accent-text: "#2d4a3e"
  accent-text-dark: "#a3c4b3"
  secondary: "#c4a13e"
  secondary-hover: "#a6852f"
  canvas: "#f5f1eb"
  canvas-dark: "#1c1916"
  page-muted: "#ebe5dc"
  surface: "#ffffff"
  surface-raised: "#f7f3ed"
  surface-panel: "#f0ebe3"
  surface-dark: "#2a2622"
  surface-panel-dark: "#2a2622"
  surface-input-dark: "#3d3832"
  text-primary: "#1a1816"
  text-primary-dark: "#f5f1eb"
  text-secondary: "#5c554d"
  text-tertiary: "#8c8379"
  text-secondary-dark: "#b8ae9f"
  border: "#ddd5c9"
  border-dark: "#4a443e"
  border-strong: "#c4b8a8"
  feedback-error: "#c44536"
  feedback-success: "#4a7c59"
  feedback-success-dark: "#7db88f"
  link-accent: "#2d4a3e"
typography:
  display:
    fontFamily: "Oswald, Impact, 'Arial Narrow Bold', sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Oswald, Impact, 'Arial Narrow Bold', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Oswald, Impact, 'Arial Narrow Bold', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  meta:
    fontFamily: "Source Sans 3, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "0"
  md: "0"
  lg: "0"
  pill: "9999px"
spacing:
  page: "24px"
  card: "20px"
  panel: "24px"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "0"
    padding: "12px 24px"
    fontFamily: "{typography.label.fontFamily}"
    fontWeight: 600
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    border: "1px solid {colors.border}"
    rounded: "0"
    padding: "8px 16px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border}"
    rounded: "0"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "0"
    padding: "20px"
  stat:
    fontFamily: "{typography.label.fontFamily}"
    fontSize: "0.75rem"
    textTransform: "uppercase"
    letterSpacing: "0.05em"
    color: "{colors.text-secondary}"
---

# Design System: Hawi's Hikes

## Overview

**Creative North Star: "The Vintage Outdoor Magazine"**

Hawi's Hikes reads like a found issue of a classic outdoor magazine: warm paper, bold condensed headlines, and every hike published as a trip story. The archive is not a utility feed; it is a curated portfolio of completed trails. Maps, elevation, and stats appear as figures and captions inside the story, never as an afterthought. The owner is the editor; the visitor is the reader.

**Key Characteristics:**

- Warm paper ground (`#f5f1eb`) in light mode; dark ink canvas (`#1c1916`) in dark mode. The color scheme is a deliberate scene choice: a magazine page in daylight, a dim reading room at night.
- Sharp corners and hairline borders; the page is printed, not molded.
- Oswald supplies the headline voice — condensed, bold, and magazine-editorial. Source Sans 3 carries body copy, stats, and labels.
- Forest green (`#2d4a3e`) is the trail accent; ochre (`#c4a13e`) marks the urgent action. Orange from the previous system does not appear.
- The list is a magazine grid: large story cards, generous whitespace, and a quiet filter strip.
- Owner tools are grouped as an "editor's desk" panel, not a separate admin zone.
- Motion is restrained: one gentle lift on cards, one slow scale on the hero image, both in service of the magazine page turning.

## Colors

### Primary

- **Forest Green** (`#2d4a3e`): Primary buttons, import/save actions, "View route" links, and active text. Hover deepens to **Pine** (`#1f352b`).
- **Ochre Blaze** (`#c4a13e`): Secondary accent for highlights, active sort, and the Strava connect callout. Hover to **Dark Ochre** (`#a6852f`).

### Neutral

- **Paper** (`#f5f1eb`) / **Night Canvas** (`#1c1916`): Page backgrounds.
- **Card White** (`#ffffff`) / **Dark Panel** (`#2a2622`): Elevated cards and panels.
- **Ink** (`#1a1816`) / **Warm Fog** (`#f5f1eb`): Headlines and primary text.
- **Trail Meta** (`#5c554d`) / **Dim Meta** (`#b8ae9f`): Dates, secondary lines, placeholders.
- **Panel Wash** (`#f0ebe3`) / **Panel Dark** (`#2a2622`): Editor's desk, stat panels, and input surfaces.
- **Hairline** (`#ddd5c9`) / **Steel Border** (`#4a443e`): Card and input borders.

### Feedback

- **Alert Red** (`#c44536`): Form errors.
- **Summit Green** (`#4a7c59` / `#7db88f` dark): Save success.

### Named Rules

**The Paper Rule.** The page background is always warm paper in light mode; white cards sit on top of it like printed inserts. Never use a cool white page background.

**The One Marker Rule.** Green and ochre are the only accent colors. No third hue appears in app chrome.

## Typography

**Display Font:** Oswald (Google Fonts) — condensed, bold, magazine headline voice.  
**Body Font:** Source Sans 3 (Google Fonts) — clean, modern, legible at small sizes.  
**Label Font:** Source Sans 3 uppercase, tracked, for stats and section markers.

### Hierarchy

- **Display** (Oswald 700, 3rem, -0.02em tracking): Page hero and product name.
- **Headline** (Oswald 600, 1.875rem, -0.01em tracking): Section titles and featured hike names.
- **Title** (Oswald 600, 1.25rem): Card titles and story names.
- **Body** (Source Sans 3 400, 0.875rem, 1.6 line-height): Descriptions, form copy, meta.
- **Label** (Source Sans 3 600, 0.75rem, uppercase, 0.05em tracking): Stat headers, buttons, and field labels.
- **Meta** (Source Sans 3 500, 0.75rem, 0.02em tracking): Dates, unit labels, and small captions.

### Named Rules

**The Headline Rule.** Oswald is reserved for display and titles. Never use it for body text or long paragraphs.

**The Stat Rule.** Numbers are set in Source Sans 3 with tabular figures where available; they are not monospaced unless they are raw code or coordinates.

## Layout

- **Page shell:** full-width hero, then a centered editorial column (`max-w-6xl`) for the list and filters.
- **Vertical rhythm:** `mb-12` between major blocks; `gap-6` on the hike grid; `space-y-4` inside editor's desk items.
- **Hike grid:** 1 column on mobile, 2 columns from `md`, and 3 columns from `lg` for the magazine card layout.
- **Hero:** full-bleed, 50vh minimum, with a slow ambient scale on the image.
- **Responsive:** Cards keep their internal structure at all sizes; the grid simply adds columns.

## Elevation & Depth

The magazine world is **flat-first**: depth comes from paper tone, borders, and the scale of type, not from shadows. The only shadow is a subtle lift on hover for cards (`shadow-sm`), and it appears only on interaction.

## Shapes

- **Default corner:** `0px` (sharp corners). Cards, inputs, buttons, and containers are all rectangular, like printed pages.
- **Pill corner:** `9999px` reserved for small tags and status badges only.
- **Borders:** 1px solid hairline gray; active states use a 1px forest-green border.

## Components

### Buttons

- **Primary:** Forest-green fill, warm-paper text, uppercase label, no border-radius. Hover deepens to pine.
- **Secondary:** Transparent, ink text, 1px hairline border. Hover text darkens; no background change.
- **Ghost:** Text-only meta color; used for "Sign out" and "Owner login".

### Cards / Containers

- **Story card:** White paper, hairline border, p-5, sharp corners. Hover lifts slightly (`-translate-y-0.5`, `shadow-sm`) and the title gains a green underline.
- **Editor's desk:** Panel wash background, hairline border, p-5, internal stack of import items.
- **Stat tile:** Inline meta text, not a separate card; stats live as caption lines beneath the hike title.

### Inputs / Fields

- **Search / Select:** White background, hairline border, sharp corners, Source Sans 3 text. Focus ring is 2px forest-green.
- **Error:** Red text below the field.

### Navigation

- No persistent nav bar. Wayfinding is contextual: the hero title links home, the owner action sits in the header, and each card links to its story.
- Text links default to ink; accent links are forest green.

## Do's and Don'ts

### Do:

- **Do** treat each hike as a published story with a headline, dateline, and stat caption.
- **Do** use generous whitespace and let the type hierarchy carry the page.
- **Do** honor system dark mode with warm dark tones, not a gray-blue default.
- **Do** keep the hero image atmospheric and without text overlays that compete with the headline.
- **Do** make owner tools feel like an editor's desk, not a separate admin dashboard.

### Don't:

- **Don't** use rounded cards, soft shadows, or gradient backgrounds as the default container language.
- **Don't** introduce additional accent hues beyond forest green and ochre.
- **Don't** use orange from the previous system in the new surfaces.
- **Don't** rely on icons + heading + text as the page structure.
- **Don't** use uppercase tracked eyebrows on every section.
