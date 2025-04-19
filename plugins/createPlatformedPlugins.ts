import type { Plugin } from 'vite';

export function createPlatformedPlugins(platform: string): [
  modulePlugin: Plugin,
  replacePlugin: Plugin,
] {
  const virtualModuleId = 'virtual:platformed';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  // Regular expression used to detect import from "virtual:platformed";
  const RE_PLATFORMED_IMPORT = /import\s*{\s*platformed\s*}\s*from\s*['"]virtual:platformed['"]/gm;

  // Regular expression used not only to detect platformed() call, but also extract the content
  // from the first argument's object (value between the curly braces).
  const RE_PLATFORMED_CALL = /platformed\(\s*{([^}]+)}\s*\)/;

  return [
    {
      name: 'platformed-module',
      resolveId(id) {
        return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
      },
      load(id) {
        // Module has no implementation at all. We don't use anything from it.
        return id === resolvedVirtualModuleId ? 'export default {}' : undefined;
      },
    },
    {
      name: 'platformed-replace',
      transform(code, id) {
        // Check if module has "platformed" import.
        if (!RE_PLATFORMED_IMPORT.test(code)) {
          return;
        }

        // Iterate over all platformed() calls and replace them with a single value depending on
        // the current platform.
        return code.replace(RE_PLATFORMED_CALL, (_: string, content: string) => {
          // "content" here is something like:
          // ```
          // common: ComponentA,
          // ios: ComponentB,
          // android: ComponentC
          // ```
          // We have to return either "ComponentA", "ComponentB", or "ComponentC".
          for (const line of content.trim().split(',')) {
            const [key, value] = line.split(':').map(v => v.trim());
            if (key === platform) {
              return value.trim();
            }
          }
          this.error(`Unable to find override for platform "${platform}" in module "${id}". Content was: "${content}"`);
        });
      },
    },
  ];
}