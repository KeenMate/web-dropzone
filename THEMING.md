# Theming Reference

Complete reference for all component states and their CSS variables for theming the `@keenmate/web-multiselect` component.

---

## Table of Contents

- [Options](#options)
- [Checkbox](#checkbox)
- [Input](#input)
- [Toggle Icon](#toggle-icon)
- [Counter Badge (in Input)](#counter-badge-in-input)
- [Dropdown](#dropdown)
- [Action Buttons](#action-buttons)
- [Badges](#badges)
- [Badge Counter Variant](#badge-counter-variant)
- [Count Display Mode](#count-display-mode)
- [Tooltip](#tooltip)
- [Selected Popover](#selected-popover)
- [Scrollbar](#scrollbar)
- [Global](#global)

---

## Options

Individual dropdown option items.

| State | CSS Class | CSS Variables |
|-------|-----------|---------------|
| **Default** | `.ms__option` | `--ms-option-background`, `--ms-option-text-color` |
| **Hover** | `:hover` | `--ms-option-background-hover`, `--ms-option-color-hover` |
| **Focused** | `--focused` | `--ms-option-background-focused`, `--ms-option-color-focused`, `--ms-option-outline-focused`, `--ms-option-focus-outline-offset` |
| **Matched** | `--matched` | `--ms-option-background-matched`, `--ms-option-color-matched`, `--ms-option-border-matched` |
| **Selected** | `--selected` | `--ms-option-background-selected`, `--ms-option-color-selected` |
| **Disabled** | `--disabled` | `--ms-disabled-opacity` |
| **Focused + Hover** | `--focused:hover` | `--ms-option-bg-focused-hover`, `--ms-option-color-focused-hover` |
| **Matched + Hover** | `--matched:hover` | `--ms-option-bg-matched-hover`, `--ms-option-color-matched-hover` |
| **Selected + Hover** | `--selected:hover` | `--ms-option-bg-selected-hover`, `--ms-option-color-selected-hover` |
| **Selected + Focused** | `--selected--focused` | `--ms-option-bg-selected-focused`, `--ms-option-color-selected-focused` |
| **Selected + Matched** | `--selected--matched` | `--ms-option-bg-selected-matched`, `--ms-option-color-selected-matched` |
| **Disabled + Selected** | `--disabled--selected` | `--ms-option-bg-disabled-selected`, `--ms-option-color-disabled-selected` |
| **Disabled + Focused** | `--disabled--focused` | *(outline removed)* |
| **Disabled + Hover** | `--disabled:hover` | *(resets to default background)* |

### Option Content

| Element | CSS Variables |
|---------|---------------|
| **Title** | `--ms-option-title-font-size`, `--ms-option-title-color` |
| **Subtitle** | `--ms-option-subtitle-font-size`, `--ms-option-subtitle-color`, `--ms-option-subtitle-margin-top`, `--ms-option-subtitle-line-height` |
| **Subtitle (hover)** | `--ms-option-subtitle-color-hover` |
| **Subtitle (selected)** | `--ms-option-subtitle-color-selected` |
| **Subtitle (selected+hover)** | `--ms-option-subtitle-color-selected-hover` |
| **Icon** | `--ms-option-icon-size`, `--ms-option-icon-font-size` |
| **Mark (highlight)** | `--ms-option-mark-background`, `--ms-option-mark-color`, `--ms-option-mark-font-weight` |

---

## Checkbox

Custom-styled checkbox within options.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Default** | `.ms__checkbox` | `--ms-checkbox-bg`, `--ms-checkbox-border`, `--ms-checkbox-border-radius`, `--ms-checkbox-size`, `--ms-checkbox-scale` |
| **Hover** | `:hover:not(:disabled)` | `--ms-checkbox-hover-border-color` |
| **Checked** | `:checked` | `--ms-checkbox-checked-bg`, `--ms-checkbox-checked-border`, `--ms-checkbox-checkmark-color` |
| **Checked + Hover** | `:checked:hover:not(:disabled)` | `--ms-checkbox-checked-bg-hover`, `--ms-checkbox-checked-border-color-hover` |
| **Focus** | `:focus-visible` | *(uses `--ms-checkbox-checked-bg` for outline)* |
| **Disabled** | `:disabled` | `--ms-checkbox-disabled-bg`, `--ms-checkbox-disabled-border` |
| **Checked + Disabled** | `:checked:disabled` | *(uses disabled background)* |

### Checkbox Positioning

| Property | CSS Variable |
|----------|--------------|
| **Alignment** | `--ms-checkbox-align` (`flex-start`, `center`, `flex-end`) |
| **Margins** | `--ms-checkbox-margin-top`, `--ms-checkbox-margin-right`, `--ms-checkbox-margin-bottom`, `--ms-checkbox-margin-left` |

---

## Input

The search/selection input field.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Default** | `.ms__input` | `--ms-input-background`, `--ms-input-color`, `--ms-input-border-style`, `--ms-input-border-radius`, `--ms-input-font-size`, `--ms-input-padding`, `--ms-input-padding-right` |
| **Hover** | `:hover:not(:focus):not(:disabled)` | `--ms-input-border-color-hover` |
| **Focus** | `:focus` | `--ms-input-border-color-focus` |
| **Placeholder** | `::placeholder` | `--ms-input-placeholder-color`, `--ms-placeholder-opacity` |
| **Disabled** | `.ms--disabled .ms__input` | `--ms-input-background-disabled`, `--ms-disabled-input-opacity` |

### Input Sizing

The component uses `--ms-rem` for proportional scaling. Default is `10px`.

| Variable | Default | Description |
|----------|---------|-------------|
| `--ms-rem` | `10px` | Base unit for all sizing calculations |
| `--ms-input-height` | `calc(3.5 * var(--ms-rem))` | Input field height (35px) |
| `--ms-input-padding` | `calc(0.8 * var(--ms-rem)) calc(1.2 * var(--ms-rem))` | Input padding |
| `--ms-input-font-size` | `calc(1.4 * var(--ms-rem))` | Input font size (14px) |

**Scale Examples:**
- `--ms-rem: 8px` → 80% size (compact)
- `--ms-rem: 10px` → 100% size (default)
- `--ms-rem: 12px` → 120% size (large)
- `--ms-rem: 1rem` → Pure Admin integration (inherits from `html { font-size: 10px }`)

---

## Toggle Icon

The dropdown arrow/chevron icon.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Default** | `.ms__toggle` | `--ms-toggle-icon-color`, `--ms-toggle-right` |
| **Open** | `.ms--open .ms__toggle` | `--ms-toggle-icon-color-open`, `--ms-transform-rotate-180` |
| **Disabled** | `.ms--disabled .ms__toggle` | `--ms-disabled-input-opacity` |

---

## Counter Badge (in Input)

Small badge showing selection count inside the input.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Default** | `.ms__counter` | `--ms-counter-badge-background`, `--ms-counter-badge-color`, `--ms-counter-font-size`, `--ms-counter-font-weight`, `--ms-counter-border-radius`, `--ms-counter-padding`, `--ms-counter-offset` |
| **Hover** | `:hover` | `--ms-counter-badge-background-hover`, `--ms-transform-scale-hover` |

---

## Dropdown

The floating options container.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Default** | `.ms__dropdown` | `--ms-dropdown-background`, `--ms-dropdown-text-color`, `--ms-dropdown-border`, `--ms-dropdown-border-radius`, `--ms-dropdown-box-shadow`, `--ms-options-max-height`, `--ms-z-index-dropdown` |
| **Visible** | `--visible` | *(display: block)* |

### Floating Hint

| State | CSS Variables |
|-------|---------------|
| **Default** | `--ms-hint-background`, `--ms-hint-color`, `--ms-hint-border`, `--ms-hint-border-radius`, `--ms-hint-box-shadow`, `--ms-hint-font-size`, `--ms-hint-padding` |

### Groups

| Element | CSS Variables |
|---------|---------------|
| **Group separator** | `--ms-group-border-top`, `--ms-group-margin-top`, `--ms-group-padding-top` |
| **Group label** | `--ms-group-label-color`, `--ms-group-label-font-size`, `--ms-group-label-font-weight`, `--ms-group-label-padding`, `--ms-group-label-transform`, `--ms-group-label-letter-spacing` |

### Empty & Loading States

| State | CSS Variables |
|-------|---------------|
| **Empty** | `--ms-empty-color`, `--ms-empty-font-size`, `--ms-empty-padding` |
| **Loading** | `--ms-loading-color`, `--ms-loading-text-font-size`, `--ms-loader-padding`, `--ms-loader-gap` |

---

## Action Buttons

Select All / Clear All buttons in dropdown.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Container** | `.ms__actions` | `--ms-actions-background`, `--ms-actions-border-bottom`, `--ms-actions-padding`, `--ms-actions-gap` |
| **Default** | `.ms__action-btn` | `--ms-action-button-background`, `--ms-action-button-color`, `--ms-action-btn-border`, `--ms-action-btn-border-radius`, `--ms-action-btn-font-size`, `--ms-action-btn-padding` |
| **Hover** | `:hover` | `--ms-action-button-background-hover`, `--ms-action-button-border-color-hover` |
| **Active** | `:active` | `--ms-transform-scale-active` |
| **Disabled** | `:disabled` | `--ms-disabled-opacity` |

---

## Badges

Selected item badges displayed outside the dropdown.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Container** | `.ms__badges` | `--ms-badges-gap`, `--ms-badges-margin-top`, `--ms-badges-margin-bottom`, `--ms-badges-margin-left`, `--ms-badges-margin-right` |
| **Badge** | `.ms__badge` | `--ms-badge-height`, `--ms-badge-font-size`, `--ms-badge-font-weight`, `--ms-badge-border-radius` |
| **Badge Text** | `.ms__badge-text` | `--ms-badge-text-background`, `--ms-badge-text-color`, `--ms-badge-text-padding`, `--ms-badge-text-border` |
| **Badge Hover** | `.ms__badge:hover .ms__badge-text` | `--ms-badge-text-background-hover`, `--ms-badge-text-color-hover` |
| **Remove Button** | `.ms__badge-remove` | `--ms-badge-remove-background`, `--ms-badge-remove-color`, `--ms-badge-remove-border`, `--ms-badge-remove-width`, `--ms-badge-remove-font-size` |
| **Remove Hover** | `.ms__badge-remove:hover` | `--ms-badge-remove-background-hover` |
| **Remove Focus** | `.ms__badge-remove:focus` | `--ms-badge-remove-box-shadow-focus` |

### Badge Border Styling

Badges have **separate borders** for the text part and remove button, allowing different colors:

```css
web-multiselect {
  /* Text part - light pink border */
  --ms-badge-text-background: #f8d7da;
  --ms-badge-text-border: 1px solid #f8d7da;

  /* Button part - dark red border matching background */
  --ms-badge-remove-background: #bb0a30;
  --ms-badge-remove-border: 1px solid #bb0a30;
}
```

---

## Badge Counter Variant

Gray/neutral badges for "+X more", count indicators, compact mode.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Container** | `.ms__badge--counter` | `--ms-badge-counter-border` |
| **Text** | `.ms__badge--counter .ms__badge-text` | `--ms-badge-counter-text-background`, `--ms-badge-counter-text-color` |
| **Remove** | `.ms__badge--counter .ms__badge-remove` | `--ms-badge-counter-remove-background`, `--ms-badge-counter-remove-color` |
| **Remove Hover** | `.ms__badge--counter .ms__badge-remove:hover` | `--ms-badge-counter-remove-background-hover` |

### "+X More" Badge

| State | CSS Variables |
|-------|---------------|
| **Default** | `--ms-more-badge-bg` |
| **Hover** | `--ms-more-badge-hover-bg` |
| **Active** | `--ms-more-badge-active-bg` |

---

## Count Display Mode

Alternative to badges - shows "X selected" with clear button.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Container** | `.ms__count-display` | `--ms-count-display-margin-top`, `--ms-count-display-margin-bottom`, `--ms-count-display-margin-left`, `--ms-count-display-margin-right` |
| **Wrapper** | `.ms__counter-wrapper` | `--ms-counter-wrapper-background`, `--ms-counter-wrapper-border`, `--ms-counter-wrapper-border-radius`, `--ms-counter-wrapper-padding`, `--ms-counter-wrapper-gap` |
| **Wrapper Hover** | `.ms__counter-wrapper:hover` | `--ms-counter-wrapper-background-hover`, `--ms-counter-wrapper-border-color-hover` |
| **Text** | `.ms__count-text` | `--ms-count-text-color`, `--ms-count-text-font-size`, `--ms-count-text-bg`, `--ms-count-text-border` |
| **Clear Button** | `.ms__count-clear` | `--ms-count-clear-background`, `--ms-count-clear-color`, `--ms-count-clear-size`, `--ms-count-clear-font-size`, `--ms-count-clear-border-radius` |
| **Clear Hover** | `.ms__count-clear:hover` | `--ms-count-clear-background-hover`, `--ms-count-clear-color-hover` |

---

## Tooltip

Badge tooltips showing full text on hover.

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Default** | `.ms__badge-tooltip` | `--ms-tooltip-background`, `--ms-tooltip-text-color`, `--ms-tooltip-padding`, `--ms-tooltip-border-radius`, `--ms-tooltip-font-size`, `--ms-tooltip-max-width`, `--ms-tooltip-shadow`, `--ms-tooltip-z-index` |
| **Visible** | `--visible` | *(opacity: 1, visibility: visible)* |

---

## Selected Popover

Popover showing all selected items (for count display mode).

| State | Selector | CSS Variables |
|-------|----------|---------------|
| **Container** | `.ms__selected-popover` | `--ms-selected-popover-background`, `--ms-selected-popover-border`, `--ms-selected-popover-border-radius`, `--ms-selected-popover-box-shadow`, `--ms-selected-popover-width`, `--ms-selected-popover-max-height`, `--ms-z-index-popover` |
| **Header** | `.ms__selected-popover-header` | `--ms-selected-popover-header-background`, `--ms-selected-popover-header-color`, `--ms-selected-popover-header-border-bottom`, `--ms-selected-popover-header-font-size`, `--ms-selected-popover-header-font-weight`, `--ms-selected-popover-header-padding` |
| **Close Button** | `.ms__selected-popover-close` | `--ms-selected-popover-close-background`, `--ms-selected-popover-close-color`, `--ms-selected-popover-close-font-size`, `--ms-selected-popover-close-border-radius`, `--ms-popover-close-size` |
| **Close Hover** | `.ms__selected-popover-close:hover` | `--ms-selected-popover-close-background-hover`, `--ms-selected-popover-close-color-hover` |
| **Body** | `.ms__selected-popover-body` | `--ms-selected-popover-body-padding`, `--ms-selected-popover-body-gap`, `--ms-selected-popover-body-max-height` |

---

## Scrollbar

Custom scrollbar styling for dropdown and popover.

| Element | CSS Variables |
|---------|---------------|
| **Width** | `--ms-scrollbar-width` |
| **Track** | `--ms-scrollbar-track-bg` |
| **Thumb** | `--ms-scrollbar-thumb-bg`, `--ms-scrollbar-thumb-border-radius` |
| **Thumb Hover** | `--ms-scrollbar-thumb-bg-hover` |

---

## Global

### Colors

| Variable | Description |
|----------|-------------|
| `--ms-accent-color` | Primary accent color |
| `--ms-accent-color-hover` | Accent color on hover |
| `--ms-accent-color-active` | Accent color when active |
| `--ms-text-primary` | Primary text color |
| `--ms-text-secondary` | Secondary/muted text color |
| `--ms-text-on-accent` | Text color on accent backgrounds (for contrast) |
| `--ms-primary-bg` | Primary background color |
| `--ms-primary-bg-hover` | Background on hover |
| `--ms-border-color` | Default border color |

### Typography

| Variable | Description | Theme Designer Integration |
|----------|-------------|---------------------------|
| `--ms-font-family` | Font family | Falls back to `--base-font-family` |
| `--ms-font-size-2xs` | 10px | Falls back to `--base-font-size-2xs` |
| `--ms-font-size-xs` | 12px | Falls back to `--base-font-size-xs` |
| `--ms-font-size-sm` | 14px | Falls back to `--base-font-size-sm` |
| `--ms-font-size-base` | 16px | Falls back to `--base-font-size-base` |
| `--ms-font-size-lg` | 18px | Falls back to `--base-font-size-lg` |
| `--ms-font-weight-normal` | 400 | Falls back to `--base-font-weight-normal` |
| `--ms-font-weight-medium` | 500 | Falls back to `--base-font-weight-medium` |
| `--ms-font-weight-semibold` | 600 | Falls back to `--base-font-weight-semibold` |
| `--ms-line-height-none` | 1 | *(no base equivalent)* |
| `--ms-line-height-tight` | 1.25 | Falls back to `--base-line-height-tight` |
| `--ms-line-height-normal` | 1.5 | Falls back to `--base-line-height-normal` |
| `--ms-line-height-relaxed` | 1.75 | Falls back to `--base-line-height-relaxed` |

#### Theme Designer Integration

When using the `@keenmate/theme-designer`, set the `--base-*` CSS variables and they will automatically be applied to the component:

```css
/* Set by theme-designer (or manually) */
:root {
  --base-font-family: "Inter", system-ui, sans-serif;
  --base-font-size-sm: 1.4rem;
  --base-font-weight-semibold: 600;
  --base-line-height-normal: 1.5;
}

/* The component picks these up automatically */
web-multiselect {
  /* --ms-font-family resolves to var(--base-font-family, inherit) */
  /* --ms-font-size-sm resolves to var(--base-font-size-sm, ...) */
}
```

### Spacing

| Variable | Description |
|----------|-------------|
| `--ms-spacing-xs` | 4px |
| `--ms-spacing-sm` | 8px |
| `--ms-spacing-md` | 12px |
| `--ms-spacing-lg` | 16px |

### Transitions

| Variable | Description |
|----------|-------------|
| `--ms-transition-fast` | 150ms |
| `--ms-transition-normal` | 200ms |
| `--ms-easing-snappy` | cubic-bezier(0.4, 0, 0.2, 1) |

### Base Unit

| Variable | Description |
|----------|-------------|
| `--ms-rem` | Base sizing unit (default: 10px). Set to `1rem` for Pure Admin integration. |

---

## Important: Text Color Contrast

When using solid/strong background colors for selected or hover states, **you must also set the corresponding text color** for proper contrast.

### Automatic Fallback Behavior

State-specific color variables use a smart fallback chain. If you don't set them, they automatically fall back to parent state colors:

- `--ms-option-color-selected-hover` → falls back to `--ms-option-color-selected` → falls back to `--ms-option-text-color`
- `--ms-option-subtitle-color-selected` → falls back to `--ms-option-subtitle-color`

This means you only need to set the base color once, and all derived states will inherit it.

### Example: Strong Accent Background Problem

```css
/* ❌ WRONG - Text will be hard to read */
web-multiselect {
  --ms-option-background-selected: #bb0a30;  /* Strong red */
  /* Text stays gray/dark = poor contrast! */
}

/* ✅ CORRECT - Set text color for contrast */
web-multiselect {
  --ms-option-background-selected: #bb0a30;  /* Strong red */
  --ms-option-color-selected: #ffffff;       /* White text */
  --ms-option-color-selected-hover: #ffffff; /* White on hover too */
}
```

### Variables That Should Be Set Together

When using solid accent backgrounds, set both background AND text color:

| Background Variable | Title Color Variable | Subtitle Color Variable |
|---------------------|---------------------|-------------------------|
| `--ms-option-background-hover` | `--ms-option-color-hover` | `--ms-option-subtitle-color-hover` |
| `--ms-option-background-selected` | `--ms-option-color-selected` | `--ms-option-subtitle-color-selected` |
| `--ms-option-bg-selected-hover` | `--ms-option-color-selected-hover` | `--ms-option-subtitle-color-selected-hover` |
| `--ms-option-background-focused` | `--ms-option-color-focused` | *(use hover)* |
| `--ms-option-background-matched` | `--ms-option-color-matched` | *(use default)* |
| `--ms-option-bg-selected-focused` | `--ms-option-color-selected-focused` | *(use selected)* |
| `--ms-option-bg-selected-matched` | `--ms-option-color-selected-matched` | *(use selected)* |

---

## Example: Corporate Red Theme (Solid Backgrounds)

```css
web-multiselect {
  /* Base colors */
  --ms-accent-color: #bb0a30;
  --ms-accent-color-hover: #8b0720;
  --ms-text-primary: #333333;
  --ms-text-secondary: #858585;

  /* Options - IMPORTANT: Set text colors for solid backgrounds */
  --ms-option-background-selected: #bb0a30;
  --ms-option-color-selected: #ffffff;                /* White title on red */
  --ms-option-subtitle-color-selected: #dbdbdb;       /* Light gray subtitle on red */
  --ms-option-bg-selected-hover: #8b0720;
  --ms-option-color-selected-hover: #ffffff;          /* White title on darker red */
  --ms-option-subtitle-color-selected-hover: #dbdbdb; /* Light gray subtitle */

  /* Checkbox on selected */
  --ms-checkbox-checked-bg: #ffffff;             /* White checkbox on red bg */
  --ms-checkbox-checkmark-color: #bb0a30;        /* Red checkmark */
}
```

---

## Example: Dark Theme

```css
web-multiselect {
  /* Base colors */
  --ms-accent-color: #60a5fa;
  --ms-accent-color-hover: #3b82f6;
  --ms-text-primary: #f3f4f6;
  --ms-text-secondary: #9ca3af;
  --ms-border-color: #374151;
  --ms-primary-bg: #1f2937;
  --ms-primary-bg-hover: #374151;

  /* Input */
  --ms-input-background: #111827;
  --ms-input-color: #f3f4f6;
  --ms-input-border-color: #374151;
  --ms-input-placeholder-color: #6b7280;

  /* Dropdown */
  --ms-dropdown-background: #1f2937;
  --ms-dropdown-border-color: #374151;

  /* Options */
  --ms-option-background: transparent;
  --ms-option-background-hover: #374151;
  --ms-option-background-selected: rgba(96, 165, 250, 0.15);

  /* Badges */
  --ms-badge-text-background: #1e3a5f;
  --ms-badge-text-color: #60a5fa;
  --ms-badge-remove-background: #3b82f6;

  /* Tooltip */
  --ms-tooltip-background: #111827;
  --ms-tooltip-text-color: #f3f4f6;
}
```
