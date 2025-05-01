import assert from 'node:assert';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { generate } from '@babel/generator';
import type { Plugin } from 'vite';
import type { Identifier, ImportDeclaration } from '@babel/types';

/**
 * Returns a plugin, responsible for code modifications related to the target built platform.
 *
 * The plugin checks if a file contains an import from "virtual:platformed". In case, it does, but
 * the module name doesn't contain the ".platformed" suffix, an error will be thrown.
 *
 * It removes platformed (having suffixes like ".ios", ".android", etc. Depends on
 * the `knownPlatforms` argument) imports for platforms, different from the `targetPlatform` one.
 * If the target platform import was not found, uses the `common` platform import.
 *
 * Each files category has its own import selection. Here is how the plugin determines the import
 * category:
 * - `s?css` -> CSS file
 * - `(j|t)sx?` or missing extension -> JavaScript file
 *
 * So, in case, you are building for "ios" and have the following imports:
 * - index.common.scss
 * - index.android.scss
 * - Component.common.js
 * - Component.android.js
 * - Component.ios.js
 * The plugin will leave only these imports:
 * - index.common.scss (because there was no CSS file to select)
 * - Component.ios.js (because it has the target platform extension)
 *
 * The plugin also replaces `platformed(...)` calls with a component, selected based on
 * the current built platform. It takes the object in the `platformed(...)` and picks a property
 * with the name equal to the current platform. If no compatible property was found, the "common"
 * one will be used.
 * @param targetPlatform - target built platform.
 * @param knownPlatforms - list of all known platforms.
 */
export function platformedPlugin(targetPlatform: string, knownPlatforms: string[]): Plugin {
  assert(
    knownPlatforms.includes(targetPlatform),
    'Known platforms list must include target platform',
  );
  knownPlatforms = [...new Set([...knownPlatforms, 'common']).values()];

  // Regular expression used to detect import from "virtual:platformed";
  const RE_PLATFORMED_IMPORT = /import\s*{\s*platformed\s*}\s*from\s*['"]virtual:platformed['"]/;
  // Regular expression to detect platformed module ID.
  const RE_PLATFORMED_ID = /\.platformed(\.(jsx?|tsx?)|)/;
  // Regular expression used to detect the import platform along with its extension. We expect
  // receiving something like [, "ios", "scss"].
  // Use this regex for tests:
  // /\.(common|ios|android)(?:\.(s?css|jsx?|tsx?))?/
  const RE_DETECT_PLATFORM = new RegExp(`\\.(${knownPlatforms.join('|')})(?:\\.(s?css|jsx?|tsx?))?`);
  let isBuild: boolean;

  return {
    name: 'platformed',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:platformed') {
        return '\0virtual:platformed';
      }
    },
    configResolved({ mode }) {
      isBuild = mode === 'production';
    },
    transform(code, id) {
      // Check if the module doesn't contain import from the "virtual:platformed" module and
      // has no ".platformed" suffix in the same time. We don't allow importing from this module
      // outside platformed files to avoid unexpected behavior.
      if (code.match(RE_PLATFORMED_IMPORT) && !id.match(RE_PLATFORMED_ID)) {
        this.error(`Module contains import from "virtual:platformed", but wasn't marked as ".platformed"`);
      }
      // If the module has no ".platformed" suffix, it should be skipped.
      if (!id.match(RE_PLATFORMED_ID)) {
        return;
      }
      // Remove import from "virtual:platformed".
      code = code.replace(RE_PLATFORMED_IMPORT, '');

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      // Collect information about all kinds of platformed imports.
      const collectedData: {
        js: [platform: string, decl: ImportDeclaration][],
        css: [platform: string, decl: ImportDeclaration][],
      } = { js: [], css: [] };

      traverse.default(ast, {
        // In this block of code we are collecting all platformed imports.
        ImportOrExportDeclaration: ({ node }) => {
          if (node.type !== 'ImportDeclaration') {
            return;
          }
          const match = node.source.value.match(RE_DETECT_PLATFORM);
          if (!match) {
            return;
          }
          const [, platform, ext] = match;
          let kind: 'js' | 'css';
          if (['css', 'scss'].includes(ext)) {
            kind = 'css';
          } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
            kind = 'js';
          } else {
            const message = `Unable to determine platformed import kind. Expected [jsx?, tsx?, s?css], but received "${ext}"`;
            if (isBuild) {
              this.error(message);
            }
            this.warn(`${message}. Import will not be omitted`);
            return;
          }
          collectedData[kind].push([platform, node]);
        },
        // Here we are going to find the "platformed(...)" call information.
        CallExpression: path => {
          const { node } = path;
          const { callee } = node;
          if (callee.type !== 'Identifier' || callee.name !== 'platformed') {
            return;
          }
          // If "platformed(...)" call was found, replace it with a single value based on
          // the current platform.
          const { arguments: args } = node;
          if (args.length !== 1) {
            this.error(`Unexpected count of arguments in platformed(...): ${args.length}`);
          }
          const [arg] = args;
          if (arg.type !== 'ObjectExpression') {
            this.error(`Unexpected argument in platformed(...): ${arg.type}`);
          }

          const { properties: argProperties } = arg;
          const [commonComponent, targetComponent] = argProperties.reduce<[
            commonComponent?: Identifier,
            targetComponent?: Identifier
          ]>((acc, prop) => {
            if (prop.type !== 'ObjectProperty') {
              this.error(`Unexpected property type in platformed(...): ${prop.type}`);
            }
            const { key: propKey, value: propValue } = prop;
            if (propKey.type !== 'Identifier') {
              this.error(`Unexpected property key type in platformed(...): ${propKey.type}`);
            }
            if (propValue.type !== 'Identifier') {
              this.error(`Unexpected property value type in platformed(...): ${propValue.type}`);
            }
            const { name: propName } = propKey;
            if (propName === 'common') {
              acc[0] = propValue;
            } else if (propName === targetPlatform) {
              acc[1] = propValue;
            }
            return acc;
          }, []);

          if (!commonComponent && !targetComponent) {
            this.error('Unable to determine component to use from platformed(...)');
          }
          path.replaceWith((targetComponent || commonComponent)!);
        },
      });

      // Iterate over all kinds of imports and do the following:
      // 1. Check if we have an import, specific to the target platform.
      // 2. If an import was found, we are removing all other platform-specific imports
      // related to other platforms.
      // 3. If no import was found, we are leaving only "common" platform-specific imports.
      const { body } = ast.program;
      (['js', 'css'] as const).forEach(kind => {
        const kindImports = collectedData[kind];
        const hasTargetPlatformImport = kindImports.some(([platform]) => {
          return platform === targetPlatform;
        });
        kindImports.forEach(([platform, decl]) => {
          if (
            (hasTargetPlatformImport && platform === targetPlatform)
            || (!hasTargetPlatformImport && platform === 'common')
          ) {
            return;
          }
          body.splice(body.indexOf(decl), 1);
        });
      });

      // Generate the transformed code.
      const output = generate(ast, {}, code);
      return { code: output.code, map: null };
    },
  };
}