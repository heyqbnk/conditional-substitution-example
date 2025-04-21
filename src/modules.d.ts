declare module "virtual:platformed" {
  type Component<P> = import('solid-js').Component<P>;

  export type PlatformID = 'ios' | 'android';

  export function platformed<P>(
    overrides: {
      common: Component<P>;
    } & Partial<Record<PlatformID, Component<P>>>,
  ): Component<P>;
}
