import type { JSX } from 'solid-js';

export function TextFieldPlaceholder(props: JSX.IntrinsicElements['p']) {
  return <p {...props} class="text-field__placeholder"/>;
}