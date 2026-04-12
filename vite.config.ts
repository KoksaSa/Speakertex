import { defineConfig, loadEnv, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

function envReplacePlugin(env: Record<string, string>): PluginOption {
  return {
    name: 'env-replace',
    transformIndexHtml(html) {
      return html
        .replace(/%VITE_YANDEX_METRIKA_ID%/g, env.VITE_YANDEX_METRIKA_ID || '')
        .replace(/%VITE_YANDEX_RTB_BLOCK_ID%/g, env.VITE_YANDEX_RTB_BLOCK_ID || '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), envReplacePlugin(env)],
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
    css: {
      preprocessorOptions: {
        scss: {},
      },
    },
  };
});
