type PlatformID = 'ios' | 'android';

declare function platformed<P>(
  overrides: {
    common: import('solid-js').Component<P>;
  } & Partial<Record<PlatformID, import('solid-js').Component<P>>>,
): import('solid-js').Component<P>;