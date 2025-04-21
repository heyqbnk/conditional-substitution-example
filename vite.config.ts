import { defineConfig, type UserConfigExport } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import autoprefixer from 'autoprefixer';

import { platformedPlugin } from './plugins/platformed/plugin';

export default defineConfig(() => {
  const platform = process.env.PLATFORM || 'common';
  const knownPlatforms = ['common', 'ios', 'android'];
  if (!knownPlatforms.includes(platform)) {
    throw new Error(`Unexpected platform received: ${platform}`);
  }

  // Plugin doesnt need in tests
  const appliedPlatformedPlugin = process.env.VITEST === 'true'
    ? []
    : [platformedPlugin(platform, knownPlatforms)];

  return {
    base: `/${platform}`,
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern' as const,
        },
      },
      postcss: {
        plugins: [
          autoprefixer(),
        ],
      },
    },
    plugins: [
      // Uncomment the following line to enable solid-devtools.
      // For more info see
      // https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme devtools(),
      solidPlugin(),
      // Allows using the compilerOptions.paths property in tsconfig.json.
      // https://www.npmjs.com/package/vite-tsconfig-paths
      tsconfigPaths(),
      ...appliedPlatformedPlugin,
    ],
    build: {
      emptyOutDir: true,
      target: 'esnext',
      minify: false,
      outDir: `dist/${platform}`,
    },
    publicDir: './public',
    server: {
      // Exposes your dev server and makes it accessible for the devices in the same network.
      host: true,
    },
    test: {
      environment: 'node',
      coverage: {
        enabled: true,
        provider: 'v8',
        include: ['plugins/**/*.ts'],
        thresholds: {
          branches: 80,
          functions: 80,
          statements: 80,
          lines: 80,
        },
      },
    },
  } satisfies UserConfigExport;
});
