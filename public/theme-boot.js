/*
 * Applies the chosen theme before the page paints.
 *
 * The palette is CSS-only on purpose (design-system/theme-dark.css): an
 * extension page cannot run an inline script, so waiting for React to read
 * chrome.storage would show one frame of the wrong theme on every open. This
 * runs first instead — a parser-blocking classic script reading the
 * localStorage mirror that shared/theme.ts writes on every change.
 *
 * Keep the key and the values in step with THEME_PREFERENCES and
 * THEME_BOOT_KEY in src/shared/theme.ts. Nothing here may throw: a page that
 * fails to boot over a theme is worse than a wrong palette.
 */
(function () {
  try {
    var choice = localStorage.getItem('arlo:theme');
    if (choice === 'dark' || choice === 'light') {
      document.documentElement.setAttribute('data-arlo', choice);
    } else {
      // 'system', unset, or nonsense: no attribute, so the OS decides.
      document.documentElement.removeAttribute('data-arlo');
    }
  } catch {
    // Storage denied. The OS preference still applies.
  }
})();
