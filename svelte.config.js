import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    // Content-Security-Policy. `hash` mode lets SvelteKit fingerprint its inline bootstrap
    // script at build time, so `script-src 'self'` works without `'unsafe-inline'`. Emitted
    // as a <meta> tag into every prerendered page (incl. the SPA fallback). `frame-ancestors`
    // is not enforceable via <meta>, so clickjacking is covered by headers in serve.js.
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        'font-src': ['self'],
        'connect-src': ['self'],
        'worker-src': ['self'],
        'manifest-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self']
      }
    }
  }
};
export default config;
