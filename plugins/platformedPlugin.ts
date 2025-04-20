import type { Plugin } from 'vite';
import assert from 'node:assert';
import * as acorn from 'acorn';
import { generate as astringGenerate } from 'astring';
import tsPlugin from 'acorn-typescript';
import jsx from 'acorn-jsx';

export function platformedPlugin(
  platform: string,
  knownPlatforms: string[],
): Plugin {
  assert(knownPlatforms.includes(platform), 'Known platforms list must include target platform');

  // Regular expression used to detect import from "virtual:platformed";
  const RE_PLATFORMED_IMPORT = /import\s*{\s*platformed\s*}\s*from\s*['"]virtual:platformed['"]/;
  // Regular expression used to detect platformed({...}) calls.
  // Example:
  // const A = platformed({ common: B, ios: C });
  //
  // Result:
  // "platformed({ common: B, ios: C });"
  const RE_PLATFORMED_CALL = /platformed\(\s*{[\s\S]*}\s*\)/;
  // Regular expression to detect platformed module ID.
  const RE_PLATFORMED_ID = /\.platformed(\.(jsx?|tsx?)|)/;
  // Regular expression to detect an import platform name.
  const RE_DETECT_PLATFORM = /\.(\w+)(?:\.(?:s?css|jsx?|tsx?)|)['"];?/;

  // Acorn parser used to parse typescript and jsx.
  const parser = acorn.Parser.extend(
    // @ts-expect-error tsPlugin has some improper types, but it seems like it works fine for us.
    tsPlugin(),
    jsx(),
  );

  return {
    name: 'platformed-replace',
    enforce: 'pre',
    transform(code, id) {
      if (code.match(RE_PLATFORMED_IMPORT) && !id.match(RE_PLATFORMED_ID)) {
        this.error(`Module contains import from "virtual:platformed", but wasn't marked as ".platformed"`);
      }
      if (!id.match(RE_PLATFORMED_ID)) {
        return;
      }
      code = code.replace(RE_PLATFORMED_IMPORT, '');

      // Regular expression to find all platform-specific imports.
      const RE_PLATFORMED_IMPORTS = new RegExp(
        `import(\\s*{[^}]+}\\s*from)?\\s*['"][\\w.\\/@~]+\\.(${knownPlatforms.join('|')})(\\.(s?css|jsx?|tsx?)|)['"];?`,
        'gm',
      );
      // Process all platform-specific imports. We have to do the following:
      // 1. Check if we have an import, specific to the target platform.
      // 2. If an import was found, we are removing all other platform-specific imports
      // related to other platforms.
      // 3. If no import was found, we are leaving only common platform-specific imports.
      const match = code.match(RE_PLATFORMED_IMPORTS);
      if (match) {
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
      code = code.replace(RE_PLATFORMED_CALL, expressionString => {
        // Parse platformed call expression and retrieve its AST.
        const ast = parser.parse(expressionString, {
          sourceType: 'module',
          ecmaVersion: 'latest',
        });
        const [declaration] = ast.body;
        if (declaration.type !== 'ExpressionStatement') {
          return this.error(
            'Expected to receive ExpressionStatement when parsing platformed() call',
          );
        }
        const { expression } = declaration;
        if (expression.type !== 'CallExpression') {
          return this.error('Expected to receive CallExpression when parsing platformed() call');
        }
        const [argument] = expression.arguments;
        if (argument.type !== 'ObjectExpression') {
          return this.error('Expected to receive object in platformed() call');
        }
        let commonValue: acorn.Expression;
        for (const property of argument.properties) {
          if (property.type === 'SpreadElement') {
            this.error(
              'platformed() call contains an object with spread element. Only explicit properties are supported',
            );
          }
          const { key } = property;
          if (key.type !== 'Identifier') {
            this.error('platformed() call contains a non-literal key');
          }
          if (key.name === platform) {
            return astringGenerate(property.value);
          }
          if (key.name === 'common') {
            commonValue = property.value;
          }
        }
        if (!commonValue) {
          this.error(
            `Unable to find override for platform "${platform}" in module "${id}". Content was: "${expressionString}"`,
          );
        }
        return astringGenerate(commonValue);
      });

      return code;
    },
  };
}