import { platformed } from 'virtual:platformed';

import { TextFieldPlaceholder } from '@/TextField/TextFieldPlaceholder.js';

export function TextFieldInput(props: { placeholderSuffix: string }) {
  return (
    <span class="text-field__input">
      <input class="text-field__input-input" type="text"
        // value="test value"
      />
      <TextFieldPlaceholder>
        I am placeholder from common. {props.placeholderSuffix}
      </TextFieldPlaceholder>
    </span>
  );
}

export function TextFieldInputIos(props: { placeholderSuffix: string }) {
  return <TextFieldInput placeholderSuffix={props.placeholderSuffix + ' / iOS baby'}/>
}

export const TextFieldInputPlatformed = platformed({
  common: TextFieldInput,
  ios: TextFieldInputIos,
});
