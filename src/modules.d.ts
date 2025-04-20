declare module "virtual:platformed" {
  export type PlatformID = 'ios' | 'android';
  export function platformed<P>(
    overrides: {
      common: import('solid-js').Component<P>;
    } & Partial<Record<PlatformID, import('solid-js').Component<P>>>,
  ): import('solid-js').Component<P>;
}