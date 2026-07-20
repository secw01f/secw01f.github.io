// Astro theme tokens, ported from secw01f-ui (src/theme/tokens.ts).
// The blog is vanilla, so instead of the React TemplateThemeProvider we flatten
// a ColorScheme into the same --template-* CSS custom properties and inject them
// at build time. Dark only — the astro scheme is the single shipped theme.
//
// Keep this in sync with secw01f-ui when the astro palette changes.

/**
 * Flatten a ColorScheme (see src/theme/presets.json) into the --template-* map.
 * Mirrors schemeToCssVars() in secw01f-ui.
 * @param {Record<string, string|number>} scheme
 * @returns {Record<string, string>}
 */
export function schemeToCssVars(scheme) {
  return {
    "--template-mode": String(scheme.mode),
    "--template-primary": scheme.primary,
    "--template-accent": scheme.accent,
    "--template-progress": scheme.progress,
    "--template-success": scheme.success,
    "--template-warning": scheme.warning,
    "--template-danger": scheme.danger,
    "--template-info": scheme.info,
    "--template-gradient-start": scheme.gradientStart,
    "--template-gradient-end": scheme.gradientEnd,
    "--template-sidebar-bg": scheme.sidebarBg,
    "--template-sidebar-text": scheme.sidebarText,
    "--template-surface-bg": scheme.surfaceBg,
    "--template-surface-elevated": scheme.surfaceElevated,
    "--template-card-shadow": scheme.cardShadow,
    "--template-border-radius": `${scheme.borderRadius}px`,
    "--template-gradient": `linear-gradient(135deg, ${scheme.gradientStart} 0%, ${scheme.gradientEnd} 100%)`,
  };
}

/**
 * Render a scheme as a `:root { ... }` CSS block for inlining into the page head,
 * so the correct theme is present on first paint with no runtime work.
 * @param {Record<string, string|number>} scheme
 * @returns {string}
 */
export function rootCss(scheme) {
  const vars = schemeToCssVars(scheme);
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${body}\n}`;
}
