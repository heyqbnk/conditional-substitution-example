import { describe, it, expect } from 'vitest';

import { platformedPlugin } from './plugin';

describe('Platformed Plugin', () => {
  it('should match plugin structure snapshot', () => {
    const plugin = platformedPlugin('common', ['common']);

    expect(plugin).toMatchInlineSnapshot(`
      {
        "enforce": "pre",
        "name": "platformed-replace",
        "transform": [Function],
      }
    `);
  });
});
