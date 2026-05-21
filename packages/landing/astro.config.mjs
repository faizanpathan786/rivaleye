// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://rivaleye.io',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    port: 4321,
  },
  devToolbar: {
    enabled: false,
  },
});
