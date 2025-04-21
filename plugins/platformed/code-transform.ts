import { Expression, Parser } from 'acorn';
import tsPlugin from 'acorn-typescript';
import jsx from 'acorn-jsx';
import { generate as astringGenerate } from 'astring';
import { Plugin } from 'vite';

import {
  RE_PLATFORMED_IMPORT,
  RE_PLATFORMED_CALL,
  RE_PLATFORMED_ID,
  RE_DETECT_PLATFORM,
  getREPlatformedImports,
} from './regex.helper';

export function getCodeTransform(
  platform: string,
  knownPlatforms: string[]
): Plugin['transform'] {
  // Acorn parser used to parse typescript and jsx.
  const parser = Parser.extend(
    // @ts-expect-error tsPlugin has some improper types, but it seems like it works fine for us.
    tsPlugin(),
    jsx(),
  );

  // Regular expression to find all platform-specific imports.
  const re_platformed_imports = getREPlatformedImports(knownPlatforms);

  return function(code, id) {
    if (code.match(RE_PLATFORMED_IMPORT) && !id.match(RE_PLATFORMED_ID)) {
      this.error(`Module contains import from "virtual:platformed", but wasn't marked as ".platformed"`);
    }

    if (!id.match(RE_PLATFORMED_ID)) {
      return;
    }

    code = code.replace(RE_PLATFORMED_IMPORT, '');

    // Process all platform-specific imports. We have to do the following:
    // 1. Check if we have an import, specific to the target platform.
    // 2. If an import was found, we are removing all other platform-specific imports
    // related to other platforms.
    // 3. If no import was found, we are leaving only common platform-specific imports.
    const foundImports = code.match(re_platformed_imports);

    if (foundImports) {
      let hasTargetPlatformImport = false;

      for (const foundImport of foundImports) {
        const platformMatch = foundImport.match(RE_DETECT_PLATFORM);

        if (!platformMatch) {
          return this.error(`Something is wrong with import "${foundImport}". Can't detect its platform`);
        }

        const [, importPlatform] = platformMatch;

        if (importPlatform === platform) {
          hasTargetPlatformImport = true;
          break;
        }
      }

      code = code.replace(re_platformed_imports, foundImport => {
        const platformMatch = foundImport.match(RE_DETECT_PLATFORM);

        if (!platformMatch) {
          return this.error(`Something is wrong with import "${foundImport}". Can't detect its platform`);
        }

        const [, importPlatform] = platformMatch;

        const isWantedImport = hasTargetPlatformImport ? importPlatform === platform : importPlatform === 'common';

        return isWantedImport ? foundImport : '';
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

      let commonValue: Expression;

      for (const property of argument.properties) {
        if (property.type === 'SpreadElement') {
          return this.error(
            'platformed() call contains an object with spread element. Only explicit properties are supported',
          );
        }

        const { key } = property;

        if (key.type !== 'Identifier' && key.type !== 'Literal') {
          return this.error('platformed() call contains a non-literal key');
        }

        const keyName = key.type === 'Identifier' ? key.name : String(key.value);

        if (keyName === platform) {
          return astringGenerate(property.value);
        }

        if (keyName === 'common') {
          commonValue = property.value;
        }
      }

      if (!commonValue) {
        return this.error(
          `Unable to find override for platform "${platform}" in module "${id}". Content was: "${expressionString}"`,
        );
      }

      return astringGenerate(commonValue);
    });

    return code;
  };
}

