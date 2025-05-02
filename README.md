# Conditional Substitution Example

This project demonstrates how developers can structure an application to split it into separate bundles for different
platforms — or even entirely different projects.

The main idea is to show that the process isn't as complicated as it seems — and that fully isomorphic applications
aren’t always the best solution. With a bit of planning, we can build something even better than simple isomorphism.

We primarily use the approach shown here across different mini apps platforms like **Telegram Mini Apps** and **VK Mini
Apps**, where having separate builds for different operating systems is often necessary.

## How It Works

This repository uses a custom [Vite plugin](./plugins/platformedPlugin.ts) designed to remove code that is specific to
platforms other than the one currently being built.

In this project, we use two platforms: `ios` and `android`. However, you're free to define any set of platforms with any
names. There is one **required** platform named `common`, which acts as a fallback when platform-specific code is not
found for the target platform.

Keep in mind that the `common` layer is intended to be shared across all platforms, while custom platform layers (like
`ios` or `android`) should not import code from one another, as doing so may lead to unexpected increases in bundle
size.

## What does the plugin do?

### Scans for `virtual:platformed` imports

The plugin looks for imports from the `virtual:platformed` module, where we use a function named `platformed` to
define platform-specific components. It checks whether the importing module has the `.platformed` suffix to ensure
proper usage.

> [!WARNING]
> Plugin behavior only applies to files with the `.platformed` suffix. Without it, the plugin will not process
> platform-specific logic.

### Filters platform-specific imports

The plugin separates imports into two categories:

- **JavaScript files**: extensions like `.js`, `.ts`, `.jsx`, `.tsx`, or missing at all
- **CSS files**: extensions like `.css`, `.scss`, `.sass`

It then keeps only the imports matching the current platform. If no match is found, it falls back to the `common`
version.

**Example:**

```ts
// App.platformed.ts
import './App.common.scss';
import './App.ios.scss';
import { AppCommon } from './App.common.js';
import { AppIos } from './App.ios.js';
import { AppAndroid } from './App.android.js';
```

When building for the `android` platform, the plugin transforms this to:

```ts
import './App.common.scss'; // No Android-specific CSS found
import { AppAndroid } from './App.android.js'; // Android-specific JS found
```

### Replaces `platformed` function calls

The plugin replaces calls to `platformed()` with the appropriate platform-specific component, using the same fallback
logic (first matching platform, then `common`).

**Example:**

```ts
// App.platformed.ts
import { platformed } from 'virtual:platformed';

const App = platformed({
  common: AppCommon,
  ios: AppIos,
});
```

Building for `android` transforms to:

```ts
const App = AppCommon; // No Android-specific component, fallback to common
```

Building for `ios` transforms to:

```ts
const App = AppIos; // iOS-specific component found
```

---

## Summary

This plugin enables you to maintain a single codebase while producing distinct builds for different platforms. It
eliminates non-relevant platform code at build time, allowing for cleaner, optimized bundles tailored to each
environment.
