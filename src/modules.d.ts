module 'virtual:platformed' {
  import { Component } from 'solid-js';
  export type PlatformID = 'common' | 'ios';

  export function platformed<P>(
    overrides?: {
      [Platform in PlatformID]?: Component<P>;
    },
  ): Component<P>;
}