import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import autoprefixer from 'autoprefixer';

import { createPlatformedPlugins } from './plugins/createPlatformedPlugins';

export default defineConfig(() => {
  const platform = process.env.PLATFORM || 'common';
  const knownPlatforms = ['common', 'ios', 'android'];
  if (!knownPlatforms.includes(platform)) {
    throw new Error(`Unexpected platform received: ${platform}`);
  }

  return {
    base: '/',
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
      ...createPlatformedPlugins(platform, knownPlatforms),
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
  };
});
