import type { Plugin } from 'vite';
import assert from 'node:assert';

export function createPlatformedPlugins(
  platform: string,
  knownPlatforms: string[],
): [modulePlugin: Plugin, replacePlugin: Plugin] {
  assert(knownPlatforms.includes(platform), 'Known platforms list must include target platform');

  const virtualModuleId = 'virtual:platformed';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  // Regular expression used to detect import from "virtual:platformed";
  const RE_PLATFORMED_IMPORT = /import\s*{\s*platformed\s*}\s*from\s*['"]virtual:platformed['"]/gm;
  // Regular expression used not only to detect platformed() calls, but also to extract the content
  // from the first argument's object (value between the curly braces).
  // Example:
  // const A = platformed({
  //   common: B,
  //   ios: C,
  // })
  // "\n  common: B,  ios: C,\n" will be captured.
  const RE_PLATFORMED_CALL = /platformed\(\s*{([^}]+)}\s*\)/;

  return [
    {
      name: 'platformed-module',
      enforce: 'pre',
      resolveId(id) {
        return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
      },
      load(id) {
        // Module has no implementation at all. We don't use anything from it.
        return id === resolvedVirtualModuleId ? 'export const platformed = {};' : undefined;
      },
    },
    {
      name: 'platformed-replace',
      enforce: 'pre',
      transform(code, id) {
        // Check if the module has the "platformed" import.
        if (!RE_PLATFORMED_IMPORT.test(code)) {
          return;
        }

        // Process all platform-specific CSS imports. We have to do the following:
        // 1. Check if we have a CSS import, specific to the target platform.
        // 2. If an import was found, we are removing all other platform-specific CSS imports
        // related to other platforms.
        // 3. If no import was found, we are leaving only common platform-specific CSS imports.
        // Regular expression to find all platform-specific imports.
        const RE_PLATFORMED_IMPORTS = new RegExp(
          `import(\\s*{[^}]+}\\s*from)?\\s*['"][\\w.\\/@~]+\\.(${knownPlatforms.join('|')})(\\.(s?css|jsx?|tsx?)|)['"];?`,
          'gm',
        );

        const match = code.match(RE_PLATFORMED_IMPORTS);
        if (match) {
          // Regular expression to detect an import platform name.
          const RE_DETECT_PLATFORM = /\.(\w+)(?:\.(?:s?css|jsx?|tsx?)|)['"];?/;

          let hasTargetPlatformImport = false;
          const foundImports = match.slice(1);
          for (const foundImport of foundImports) {
            const platformMatch = foundImport.match(RE_DETECT_PLATFORM);
            if (!platformMatch) {
              this.error(`Something is wrong with import "${foundImport}". Can't detect its platform`);
            }
            const [, importPlatform] = platformMatch;
            if (importPlatform === platform) {
              hasTargetPlatformImport = true;
              break;
            }
          }

          code = code.replace(RE_PLATFORMED_IMPORTS, foundImport => {
            const platformMatch = foundImport.match(RE_DETECT_PLATFORM);
            if (!platformMatch) {
              this.error(`Something is wrong with import "${foundImport}". Can't detect its platform`);
            }
            const [, importPlatform] = platformMatch;

            return (hasTargetPlatformImport && importPlatform === platform)
            || (!hasTargetPlatformImport && importPlatform === 'common')
              ? foundImport
              : '';
          });
        }

        // Iterate over all platformed() calls and replace them with a single value depending on
        // the current platform.
        code = code.replace(RE_PLATFORMED_CALL, (_: string, content: string) => {
          // "content" here is something like:
          // ```
          // common: ComponentA,
          // ios: ComponentB,
          // android: ComponentC
          // ```
          // We have to return either "ComponentA", "ComponentB", or "ComponentC" depending on
          // the platform we are currently building for.
          let commonValue: string;
          for (const line of content.trim().split(',')) {
            const [key, value] = line.split(':').map(v => v.trim());
            if (key === platform) {
              return value.trim();
            }
            // Not to iterate twice, we memoize the common layer value, so we could use it
            // in case there was no value found for the target platform. The common layer in this
            // case is a fallback.
            if (key === 'common') {
              commonValue = value;
            }
          }
          if (!commonValue) {
            this.error(`Unable to find override for platform "${platform}" in module "${id}". Content was: "${content}"`);
          }
          return commonValue;
        });

        return code;
      },
    },
  ];
}