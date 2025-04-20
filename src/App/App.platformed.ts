import { platformed } from 'virtual:platformed';

import { AppCommon } from '@/App/App.common.js';
import { AppIos } from '@/App/App.ios.js';

export const AppPlatformed = platformed({
  common: AppCommon,
  ios: AppIos,
});