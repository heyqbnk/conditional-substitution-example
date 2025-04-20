module 'virtual:platformed' {
  import { Component } from 'solid-js';
  export type PlatformID = 'common' | 'ios' | 'android';

  export function platformed<P>(overrides: Partial<PlatformID, Component<P>>): Component<P>;
}