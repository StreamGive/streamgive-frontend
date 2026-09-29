# Theming and dark mode

## Overview

StreamGive uses Tailwind CSS v4 with CSS-first configuration.

Tailwind is imported in `src/app/globals.css`:

```css
@import 'tailwindcss';
```

The project does not use a `tailwind.config` file. Global theme behaviour, including the dark-mode variant and browser `color-scheme`, is configured in `src/app/globals.css`.

At present, `globals.css` does not define custom CSS theme tokens such as `--background` or `--primary`. Components use Tailwind utility classes, including `dark:` variants, for styling.

## Dark mode

Dark mode is class-based. StreamGive uses the `.dark` class on the root `<html>` element rather than relying only on the operating system preference.

`src/app/globals.css` defines a custom Tailwind dark variant:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This means Tailwind utilities prefixed with `dark:` apply when `<html>` has the `dark` class.

For example:

```tsx
<div className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
  Content
</div>
```

In light mode, this element uses a white background and dark text. When the `dark` class is on `<html>`, it uses a dark background and light text.

## Theme selection and persistence

The active theme is either `light` or `dark`.

The theme preference is stored in browser `localStorage` with the key `theme`. Theme helpers live in `src/lib/theme.ts`.

On page load, `THEME_INIT_SCRIPT` runs in the document `<head>` before React hydration:

1. It reads the saved value from `localStorage`.
2. If there is no saved preference, it uses the system preference from `prefers-color-scheme`.
3. It adds either `light` or `dark` to the root `<html>` element before the page paints.

Running this script before hydration prevents a flash where the page briefly renders with the system theme before changing to the user’s saved choice.

`src/app/layout.tsx` includes the script directly in `<head>`:

```tsx
<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
```

Because the server cannot know the visitor’s stored preference, the root `<html>` element uses `suppressHydrationWarning`. This suppresses the expected React hydration warning caused by the script adding `light` or `dark` in the browser before React hydrates.

## Browser colour scheme

`src/app/globals.css` sets the browser `color-scheme` property:

```css
html {
  color-scheme: light dark;
}

html.dark {
  color-scheme: dark;
}

html.light {
  color-scheme: light;
}
```

Before an explicit preference is applied, `color-scheme: light dark` lets browser-native controls and scrollbars follow the system setting.

After the theme script or theme toggle adds `light` or `dark` to `<html>`, the matching rule makes browser-native UI match the selected theme.

## Applying a theme

Use `applyTheme` from `src/lib/theme.ts` when implementing a theme toggle:

```ts
import { applyTheme } from '@/lib/theme';

applyTheme('dark');
```

`applyTheme`:

1. Adds or removes the `dark` class on `<html>`.
2. Adds or removes the `light` class on `<html>`.
3. Saves the selected preference to `localStorage`.

The function handles unavailable browser storage gracefully. If `localStorage` cannot be used, the selected theme still works for the current session but is not persisted.

## Adding a theme token

There are no shared CSS custom-property tokens in `src/app/globals.css` yet. Introduce a token only when a value is reused across multiple components or represents a stable part of the design system.

When adding a semantic colour token:

1. Add the light value to `:root` in `src/app/globals.css`.
2. Add the matching dark-mode value under `html.dark`.
3. Use a semantic name that describes the role, not a specific colour, such as `--surface`, `--surface-muted`, or `--text-subtle`.
4. Map the value through Tailwind v4's CSS-first theme configuration if a reusable Tailwind utility is required.
5. Replace repeated hard-coded values with the new semantic token where appropriate.
6. Check the affected interface in both light and dark mode.

For example:

```css
:root {
  --surface: white;
}

html.dark {
  --surface: #030712;
}
```

Do not add a token for a value used in only one component unless it is expected to become a shared design-system value.

## Adding a component style

Reusable UI components are organised by feature or cross-cutting concern under `src/components/`. See `docs/COMPONENTS.md` for the current component structure and conventions.

Use Tailwind utility classes in component markup for component-specific styling. When a component needs different colours in dark mode, use `dark:` utilities:

```tsx
<button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400">
  Save
</button>
```

Add global CSS to `src/app/globals.css` only for global styling, browser-level behaviour, or reusable design tokens. Do not add component-specific styles globally when Tailwind utilities in the component are sufficient.

## Validation

Run these commands before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
```