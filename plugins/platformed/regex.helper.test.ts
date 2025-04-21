import { describe, it, expect } from 'vitest';

import {
  RE_PLATFORMED_IMPORT,
  RE_PLATFORMED_CALL,
  RE_PLATFORMED_ID,
  RE_DETECT_PLATFORM,
  getREPlatformedImports
} from './regex.helper';

describe('Regular Expressions', () => {
  describe('RE_PLATFORMED_IMPORT', () => {
    const testCases = [
      {
        input: `import { platformed } from "virtual:platformed"`,
        shouldMatch: true,
      },
      {
        input: `import { platformed } from "virtual:platformed";`,
        shouldMatch: true,
      },
      {
        input: `\nimport { platformed } from "virtual:platformed";`,
        shouldMatch: true,
      },
      {
        input: `\r\nimport { platformed } from "virtual:platformed";`,
        shouldMatch: true,
      },
      {
        input: `\n    import { platformed } from "virtual:platformed";`,
        shouldMatch: true,
      },
      {
        input: `import{platformed}from'virtual:platformed';`,
        shouldMatch: true,
      },
      {
        input: `import 'virtual:platformed';`,
        shouldMatch: false,
      },
      {
        input: `import { other } from "virtual:platformed";`,
        shouldMatch: false,
      },
      {
        input: `const platformed = require("virtual:platformed");`,
        shouldMatch: false,
      },
    ];

    it.each(testCases)('should $shouldMatch match "$input"', ({ input, shouldMatch }) => {
      expect(RE_PLATFORMED_IMPORT.test(input)).toBe(shouldMatch);
    });
  });

  describe('RE_PLATFORMED_CALL', () => {
    const testCases = [
      {
        input: `platformed({ common: 1, ios: 2 })`,
        shouldMatch: true,
      },
      {
        input: `platformed(  { \n key: "value" } )`,
        shouldMatch: true,
      },
      {
        input: `// platformed({ fake: true })`,
        shouldMatch: true,
      },
      {
        input: `notPlatformed({ common: 1 })`,
        shouldMatch: false,
      }
    ];

    it.each(testCases)('should $shouldMatch match "$input"', ({ input, shouldMatch }) => {
      expect(!!input.match(RE_PLATFORMED_CALL)).toBe(shouldMatch);
    });
  });

  describe('RE_PLATFORMED_ID', () => {
    const testCases = [
      {
        input: `file.platformed.js`,
        shouldMatch: true,
      },
      {
        input: `file.platformed.jsx`,
        shouldMatch: true,
      },
      {
        input: `file.platformed.ts`,
        shouldMatch: true,
      },
      {
        input: `file.platformed.tsx`,
        shouldMatch: true,
      },
      {
        input: `file.platformed.mjs`,
        shouldMatch: false,
      },
      {
        input: `file.js`,
        shouldMatch: false,
      },
      {
        input: `.platformed.css`,
        shouldMatch: false,
      },
    ];

    it.each(testCases)('should $shouldMatch match "$input"', ({ input, shouldMatch }) => {
      expect(RE_PLATFORMED_ID.test(input)).toBe(shouldMatch);
    });
  });

  describe('RE_DETECT_PLATFORM', () => {
    const testCases = [
      {
        input: `import './components.ios.js'`,
        expected: 'ios'
      },
      {
        input: `import './components.ios.js';`,
        expected: 'ios'
      },
      {
        input: `from 'styles.android.scss';`,
        expected: 'android'
      },
      {
        input: `require('utils.common.ts');`,
        expected: undefined
      },
    ];

    it.each(testCases)('should extract "$expected" from "$input"', ({ input, expected }) => {
      const match = input.match(RE_DETECT_PLATFORM);
      expect(match?.[1]).toBe(expected);
    });
  });

  describe('getREPlatformedImports', () => {
    const knownPlatforms = ['common', 'ios', 'android'];
    const re = getREPlatformedImports(knownPlatforms);

    const testCases = [
      {
        input: `import { Button } from './components.android.js'`,
        result: [`import { Button } from './components.android.js'`],
      },
      {
        input: `import { Button } from './components.android.js';`,
        result: [`import { Button } from './components.android.js';`],
      },
      {
        input: [
          `import { Button } from './components.common.js';`,
          `import { Button } from './components.ios.js';`,
          `import { Button } from './components.android.js';`,
        ].join('\n'),
        result: [
          `import { Button } from './components.common.js';`,
          "\nimport { Button } from './components.ios.js';",
          "\nimport { Button } from './components.android.js';",
        ],
      },
      {
        input: `import styles from './app.ios.scss';`,
        // result: [`import styles from './app.ios.scss';`],
      },
      {
        input: `export * from './utils.common.ts';`,
        // result: [`export * from './utils.common.ts';`],
      },
      {
        input: `import 'third-party/module.js';`,
      },
      {
        input: `require('./invalid.platform.js');`,
      }
    ];

    it.each(testCases)(
      'should $shouldMatch match "$input"',
      ({ input, result }) => {
        const match = input.match(re);
        expect(!!match).toBe(!!result);

        if (result) {
          expect(match).toMatchObject(result);
        }
      }
    );

    it('should handle common fallback when no platform exists', () => {
      const code = `
        import { A } from './out.common.js';
        import { B } from './out.android.js';
        import { C } from './out.ios.js';
      `;

      const matches = code.match(re) || [];
      const foundPlatforms = Array.from(matches)
        .map((m) => m.match(RE_DETECT_PLATFORM)?.[1]);

      expect(foundPlatforms).toEqual(['common', 'android', 'ios']);
    });
  });
});
