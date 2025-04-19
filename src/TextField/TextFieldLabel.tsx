import type { JSX } from 'solid-js';

export function TextFieldLabel(props: JSX.IntrinsicElements['p']) {
  return <p {...props} class="text-field__label"/>;
}