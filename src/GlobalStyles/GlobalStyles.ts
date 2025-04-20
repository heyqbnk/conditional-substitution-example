import { platformed } from 'virtual:platformed';

import './GlobalStyles.common.scss';
import './GlobalStyles.ios.scss';
import './GlobalStyles.android.scss';

export const GlobalStyles = platformed({
  common() {
    return null;
  },
});