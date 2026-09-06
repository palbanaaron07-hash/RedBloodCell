import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

const rootHtmlPages = [
  'index.html',
  'homie.html',
  'learn_more.html',
  'login.html',
  'register.html',
  'forgot-password.html',
  'donor_registration.html',
  'patient_dashboard.html',
  'patient_donor_map.html',
  'patient_notifications.html',
  'admin_dashboard.html'
];

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        rootHtmlPages.map((page) => [page.replace(/\.html$/, ''), resolve(rootDirectory, page)])
      )
    }
  }
});
