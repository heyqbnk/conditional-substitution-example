import { App } from '@/App/App.js';

import { GlobalStyles } from '@/GlobalStyles/GlobalStyles.js';

export function Root() {
  return (
    <main class="root">
      <GlobalStyles/>
      <App/>
    </main>
  )
}