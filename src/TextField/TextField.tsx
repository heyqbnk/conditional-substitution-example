import { TextFieldLabel } from '@/TextField/TextFieldLabel.js';
import { TextFieldInputPlatformed } from '@/TextField/TextFieldInput.js';

import './TextField.scss';

export function TextField() {
  return (
    <label class="text-field">
      <TextFieldLabel>Text field label</TextFieldLabel>
      <TextFieldInputPlatformed placeholderSuffix="Common"/>
    </label>
  );
}