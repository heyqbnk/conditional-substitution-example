import type { Plugin } from 'vite';
import assert from 'node:assert';
import { getCodeTransform } from './code-transform';

export function platformedPlugin(
  platform: string,
  knownPlatforms: string[],
): Plugin {
  assert(knownPlatforms.includes(platform), 'Known platforms list must include target platform');

  const transform = getCodeTransform(platform, knownPlatforms);
  return {
    name: 'platformed-replace',
    enforce: 'pre',
    transform,
  };
}
