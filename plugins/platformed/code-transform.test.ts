import { describe, it, expect } from 'vitest';

import { getCodeTransform } from './code-transform';

function getTransformHandler(platform: string, knownPlatforms: string[]) {
  const context = {
    error: (msg: string) => {
      throw new Error(msg);
    },
  };

  const transform = getCodeTransform(platform, knownPlatforms);
  const handler = typeof transform === 'function' ? transform : transform.handler;

  return handler.bind(context);
}

describe('process code-transform', () => {
  describe('common', () => {
    const platform = 'ios';
    const knownPlatforms = ['common', 'ios', 'android'];
    const transform = getTransformHandler(platform, knownPlatforms);

    describe('Error Handling', () => {
      it('should throw when virtual import in non-platformed file', () => {
        const code = `import { platformed } from 'virtual:platformed';`;
        const nonPlatformedId = '/normal/file.js';

        expect(() => transform(code, nonPlatformedId)).toThrowError(
          /^Module contains import from "virtual:platformed", but wasn't marked as ".platformed"$/
        );
      });

      it('should throw on invalid platformed() call structure', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        platformed({
          ...spread,
          ios: 'valid'
        });
      `;

        expect(() => transform(code, platformedId)).toThrowError(
          /platformed\(\) call contains an object with spread element/
        );
      });

      it('should undefined on non platformed file', () => {
        const code = `const test = 1;`;
        expect(transform(code, 'file.test.js')).toBeUndefined();
      });

      it('should error on spread element in platformed object', () => {
        const code = `platformed({ ...common, ios: 2 });`;
        expect(() => transform(code, 'file.platformed.js')).toThrow('spread element');
      });

      it('should error on non-Identifier key in platformed object', () => {
        const code = `platformed({ [Symbol('1')]: 1, ios: 1 });`;
        expect(() => transform(code, 'file.platformed.js')).toThrow('non-literal key');
      });

      it('should error if no common or target platform', () => {
        const code = `platformed({ android: 2 });`;
        expect(() => transform(code, 'file.platformed.js')).toThrow('Unable to find override');
      });
    });

    describe('Import Processing', () => {
      it('should remove virtual imports and process platform-specific imports', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        import { platformed} from 'virtual:platformed';
        import { Button } from './components.ios.js';
        import { Modal } from './components.android.js';
        import { Card } from './components.common.js';
      `;

        const result = transform(code, platformedId);
        expect(result).not.toContain('virtual:platformed');
        expect(result).toContain('components.ios.js');
        expect(result).not.toContain('components.android.js');
        expect(result).not.toContain('components.common.js');
      });

      it('should keep common imports when no platform-specific imports exist', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        import { Card } from './components.common.js';
        import { Text } from './components.test.js';
      `;

        const result = transform(code, platformedId);
        expect(result).toContain('components.common.js');
        expect(result).toContain('components.test.js');
      });
    });

    describe('platformed() Call Transformation', () => {
      it('should replace platformed() with platform-specific value', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        const config = platformed({
          'ios': 'IOS_CONFIG',
          'android': 'ANDROID_CONFIG',
          'common': 'COMMON_CONFIG'
        });
      `;

        const result = transform(code, platformedId);
        expect(result).toMatch(/const config = 'IOS_CONFIG';/);
      });

      it('should fall back to common when platform-specific value missing', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        const size = platformed({
          android: 42,
          common: 24
        });
      `;

        const result = transform(code, platformedId);
        expect(result).toMatch(/const size = 24;/);
      });

      it('should handle complex AST structures without generic', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        const styles = platformed({
          ios: { color: 'red' },
          common: { padding: 10 }
        });
      `.trim();

        const result = transform(code, platformedId);
        expect(result).toMatchInlineSnapshot(`
        "const styles = {\n  color: 'red'\n};"
      `);
      });

      it('should handle complex AST structures with generic', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        const styles = platformed<object>({
          ios: { color: 'red' },
          common: { padding: 10 }
        });
      `.trim();

        const result = transform(code, platformedId);
        expect(result).toMatchInlineSnapshot(`
        "const styles = {\n  color: 'red'\n};"
      `);
      });
    });

    describe('Edge Cases', () => {
      it('should handle multiple platformed calls', () => {
        const platformedId = '/path/to/file.platformed.js';
        const code = `
        const a = platformed({ ios: 1, common: 0 });
        const b = platformed({ android: 2, common: 0 });
      `.trim();

        const result = transform(code, platformedId);
        expect(result).toContain('const a = 1;');
        expect(result).toContain('const b = 0;');
      });

      it('should process different file types', () => {
        const tsCode = `
        const value = platformed<string>({ ios: 'ios', common: 'common' });
      `.trim();
        const tsxId = '/file.platformed.tsx';

        const result = transform(tsCode, tsxId);
        expect(result).toContain("const value = 'ios';");
      });
    });
  });

  describe('Real case tsx', () => {
    const knownPlatforms = ['common', 'ios', 'android'];
    const baseCode = `
      import { platformed } from 'virtual:platformed';
      import { AppCommon } from '@/App/App.common.js';
      import { AppIos } from '@/App/App.ios.js';

      export const AppPlatformed = platformed({
        common: AppCommon,
        ios: AppIos,
      });
    `;

    describe('iOS Platform', () => {
      const platformedId = '/src/App.platformed.tsx';
      const transform = getTransformHandler('ios', knownPlatforms);

      it('should select iOS implementation and retain relevant imports', () => {
        const result = transform(baseCode, platformedId);

        // Virtual import removed
        expect(result).not.toContain('virtual:platformed');

        // Platform-specific imports retained
        expect(result).not.toContain('App.common.js');
        expect(result).toContain('App.ios.js');

        // Correct implementation selected
        expect(result).toMatch(/export const AppPlatformed = AppIos/);
      });
    });

    describe('Android Platform', () => {
      const platformedId = '/src/App.platformed.tsx';
      const transform = getTransformHandler('android', knownPlatforms);

      it('should fallback to common and filter imports', () => {
        const result = transform(baseCode, platformedId);

        // Only common import remains
        expect(result).toContain('App.common.js');
        expect(result).not.toContain('App.ios.js');

        // Falls back to common implementation
        expect(result).toMatch(/export const AppPlatformed = AppCommon/);
      });

      it('should handle Android-specific implementation when present', () => {
        const androidCode = baseCode
          .replace('App.ios.js', 'App.android.js')
          .replace('ios: AppIos', 'android: AppAndroid');

        const result = transform(androidCode, platformedId);

        expect(result).toContain('App.android.js');
        expect(result).toMatch(/export const AppPlatformed = AppAndroid/);
      });

      it('should error when missing common fallback', () => {
        const dangerousCode = `
          import { platformed } from 'virtual:platformed';
          export const AppPlatformed = platformed({ ios: AppIos });
        `;

        expect(() => transform(dangerousCode, platformedId))
          .toThrowError(/Unable to find override for platform "android"/);
      });
    });

    describe('Import Validation', () => {
      it('should reject virtual imports in non-platformed files', () => {
        const transform = getTransformHandler('ios', knownPlatforms);
        const normalFileId = '/src/App.tsx';

        expect(() => transform(baseCode, normalFileId))
          .toThrowError(/marked as ".platformed"/);
      });
    });
  });

  describe('Real case style', () => {
    const knownPlatforms = ['common', 'ios', 'android'];
    const baseCode = `
      import './GlobalStyles.ios.scss';
      import './GlobalStyles.common.scss';
    `;

    describe('iOS Platform', () => {
      const platformedId = '/src/GlobalStyles.platformed.tsx';
      const transform = getTransformHandler('ios', knownPlatforms);

      it('should select iOS implementation and retain relevant imports', () => {
        const result = transform(baseCode, platformedId);

        // Virtual import removed
        expect(result).not.toContain('virtual:platformed');

        // Platform-specific imports retained
        expect(result).not.toContain('GlobalStyles.common.scss');
        expect(result).toContain('GlobalStyles.ios.scss');

        // Correct implementation selected
        expect(result).toMatch(/import '\.\/GlobalStyles.ios.scss';/);
      });
    });

    describe('Android Platform', () => {
      const platformedId = '/src/GlobalStyles.platformed.tsx';
      const transform = getTransformHandler('android', knownPlatforms);

      it('should fallback to common and filter imports', () => {
        const result = transform(baseCode, platformedId);

        // Only common import remains
        expect(result).toContain('GlobalStyles.common.scss');
        expect(result).not.toContain('GlobalStyles.ios.scss');

        // Falls back to common implementation
        expect(result).toMatch(/import '\.\/GlobalStyles.common.scss';/);
      });

      it('should handle Android-specific implementation when present', () => {
        const androidCode = baseCode
          .replace('GlobalStyles.ios.scss', 'GlobalStyles.android.scss')
          .replace('ios: GlobalStylesIos', 'android: GlobalStylesAndroid');

        const result = transform(androidCode, platformedId);

        expect(result).toContain('GlobalStyles.android.scss');
        expect(result).toMatch(/import '\.\/GlobalStyles.android.scss';/);
      });

      it('should error when missing common fallback', () => {
        const dangerousCode = `
          import { platformed } from 'virtual:platformed';
          export const AppPlatformed = platformed({ ios: AppIos });
        `;

        expect(() => transform(dangerousCode, platformedId))
          .toThrowError(/Unable to find override for platform "android"/);
      });
    });
  });
});
