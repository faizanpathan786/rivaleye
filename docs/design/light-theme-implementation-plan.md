# Light Theme Implementation Plan — RivalEye Landing Page

**Status:** Planning  
**Scope:** Convert dark-themed landing page to light theme  
**Effort:** Medium (CSS variables + testing)  

---

## Overview

The RivalEye landing page currently uses a dark theme built on Tailwind CSS custom properties (CSS variables). Implementing a light theme requires:

1. Defining a light color palette
2. Updating CSS variable mappings
3. Adding a theme toggle or auto-detection
4. Testing all components for contrast and readability

---

## Current Dark Theme Variables

Location: `packages/landing/src/styles/globals.css` (or similar root style file)

**Current dark palette:**
```css
--color-bg-0: (darkest background, e.g., #0a0a0a)
--color-bg-1: (mid background, e.g., #141414)
--color-bg-2: (lighter background, e.g., #1a1a1a)
--color-bg-3: (subtle bg, e.g., #222)
--color-bg-4: (accents)
--color-fg-0: (primary text, white)
--color-fg-1: (secondary text, lighter gray)
--color-fg-2: (tertiary text, muted gray)
--color-fg-3: (very muted)
--color-fg-4: (almost invisible)
--color-lime: (accent, e.g., #bfff00)
--color-line-0, -1, -2, -3: (border colors)
--color-rose: (error/warning accent)
--color-amber: (warning accent)
```

---

## Light Theme Palette (Proposed)

Invert the contrast while maintaining the lime accent and terminal aesthetic:

```css
/* Light mode */
--color-bg-0: #ffffff (white)
--color-bg-1: #f5f5f5 (very light gray)
--color-bg-2: #ececec (light gray)
--color-bg-3: #e0e0e0 (mid gray)
--color-bg-4: #d0d0d0 (darker gray for subtle elements)
--color-fg-0: #000000 (black text)
--color-fg-1: #333333 (dark gray text)
--color-fg-2: #666666 (medium gray text)
--color-fg-3: #999999 (light gray text)
--color-fg-4: #cccccc (very light gray text)
--color-lime: #5fa200 (darker lime, maintains accent prominence)
--color-line-0: #d9d9d9 (visible borders)
--color-line-1: #e6e6e6 (subtle borders)
--color-line-2: #f0f0f0 (very subtle borders)
--color-line-3: #f5f5f5 (almost invisible borders)
--color-rose: #d11a3a (darker rose for warnings)
--color-amber: #ff9f1c (darker amber for cautions)
```

---

## Implementation Approach

### Option A: CSS Media Query (Auto-Detection)

Use `prefers-color-scheme` to automatically switch themes based on OS/browser preference.

**Files to modify:**
- `packages/landing/src/styles/globals.css` (or root CSS file)

**Implementation:**
```css
/* Dark mode (default / explicit) */
:root {
  --color-bg-0: #0a0a0a;
  --color-fg-0: #ffffff;
  /* ... rest of dark palette */
}

/* Light mode (respects OS preference) */
@media (prefers-color-scheme: light) {
  :root {
    --color-bg-0: #ffffff;
    --color-fg-0: #000000;
    /* ... rest of light palette */
  }
}
```

**Pros:**
- Simple, no JS needed
- Respects user OS/browser preference
- Minimal performance impact

**Cons:**
- No manual toggle (users must change OS settings)
- Both themes must be maintained in CSS

---

### Option B: Manual Toggle with Local Storage

Add a theme toggle button + localStorage to remember user preference.

**Files to modify:**
- `packages/landing/src/styles/globals.css` (color variables)
- `packages/landing/src/components/Nav.astro` (add toggle button)
- `packages/landing/src/scripts/theme-toggle.js` (new file)

**Implementation:**
```html
<!-- In Nav.astro -->
<button id="theme-toggle" aria-label="Toggle theme">🌙 / ☀️</button>

<script>
// Check localStorage, else use OS preference, else default to dark
const saved = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = saved ? saved === 'dark' : prefersDark;
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

// Toggle button
document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});
</script>
```

```css
/* CSS with data-theme attribute */
:root {
  /* Dark by default */
  --color-bg-0: #0a0a0a;
}

[data-theme="light"] {
  --color-bg-0: #ffffff;
  /* ... rest of light palette */
}
```

**Pros:**
- User control over theme preference
- Preference persisted across sessions
- Fallback to OS preference if no localStorage

**Cons:**
- Requires JavaScript
- Needs toggle UI (adds component)
- Slight FOUC (flash of unstyled content) unless SSR handled carefully

---

### Option C: Astro-Level Theme Support

Implement theme via Astro context/props and pass to all components.

**More complex, requires:**
- Astro layout changes
- Theme provider pattern
- Global state management

**Not recommended for this project** — Option A or B is better.

---

## Recommended Approach: **Option A (Auto-Detection)**

**Rationale:**
- Minimal code changes (CSS only)
- No JS or toggle component needed
- Aligns with modern web standards
- User gets expected theme (respects OS preference)

**Files to change:**
1. `packages/landing/src/styles/` — Update CSS variables in root selector + add `@media (prefers-color-scheme: light)` block

**Testing required:**
- [ ] Test in Safari (dark mode)
- [ ] Test in Chrome (dark mode + light mode toggle)
- [ ] Test in Firefox (dark mode + light mode toggle)
- [ ] Verify contrast ratios (WCAG AA minimum 4.5:1 for text)
- [ ] Verify terminal aesthetic still works (scanlines, glows, borders)
- [ ] Test on mobile (iOS light/dark mode)

---

## Color Contrast Verification

When light theme is implemented, verify WCAG AA compliance:

| Element | Light Theme | Min Ratio | Check |
|---------|------------|-----------|-------|
| Body text (fg-0 on bg-0) | #000000 on #ffffff | 4.5:1 | ✅ 21:1 |
| Secondary text (fg-2 on bg-0) | #666666 on #ffffff | 4.5:1 | ⚠️ 3.5:1 (NEEDS FIX) |
| Lime accent on bg-0 | #5fa200 on #ffffff | 3:1 | ✅ 3.8:1 |
| Links/hover states | #5fa200 on light bg | 3:1 | ⚠️ Test all backgrounds |

**Action:** May need to adjust `--color-fg-2` and `--color-fg-3` to darker values for sufficient contrast.

---

## Component-Specific Notes

### Terminal/Scanlines Aesthetic
- Scanlines effect (`bg-grid`, `scanlines` class) should remain visible in light theme
- May need to adjust scanline opacity/color (currently light gray)
- Border colors (currently light in dark theme) need darkening for visibility

### Glow Effects
- Lime glow (`glow-lime-text`, `glow-lime-md`) may be too subtle on light bg
- Test and consider increasing opacity or changing to a slightly darker lime

### Animations
- Pulse animations (`animate-pulse-lime`, `animate-blink`) should work in both themes
- Test blinking cursor and pulsing dots on light theme

---

## Estimated Effort

| Task | Time |
|------|------|
| Define light color palette | 30 min |
| Update CSS variables in globals.css | 1 hour |
| Test on desktop (Chrome, Safari, Firefox) | 1 hour |
| Test on mobile (iOS, Android) | 30 min |
| Verify WCAG contrast, adjust if needed | 30 min |
| Test all interactive elements (hover, focus) | 30 min |
| **Total** | **4–5 hours** |

---

## Files to Modify

```
packages/landing/src/styles/globals.css (or index.css / main.css)
packages/landing/tailwind.config.ts (if using Tailwind theme config)
```

**No changes needed to:**
- Astro components
- Layout
- HTML structure
- JavaScript (for Option A)

---

## Next Steps

1. **Confirm light theme approach** — Option A (auto-detect) recommended?
2. **Define exact light palette** — Review proposed colors, adjust as needed
3. **Update CSS variables** — Implement `@media (prefers-color-scheme: light)`
4. **Test on all browsers/devices** — Verify contrast, readability, aesthetics
5. **Create PR** — Light theme as separate commit from copy update

---

## Decision Points for User

- [ ] **Proceed with light theme?** (Yes / No / Maybe later)
- [ ] **Which approach?** (A: Auto-detect / B: Toggle / C: Other)
- [ ] **Include with copy update PR or separate PR?** (Combined / Separate)
- [ ] **Priority?** (Do after copy update / Do in parallel)

**Current status:** Copy update is complete and ready to commit. Light theme is optional follow-up.
