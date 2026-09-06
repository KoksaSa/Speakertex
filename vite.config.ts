import { defineConfig, loadEnv, PluginOption } from 'vite';
import react from '@vitejs/plugin-react';

export function envReplacePlugin(env: Record<string, string>): PluginOption {
  // ID Яндекс.Метрики: можно переопределить через VITE_YANDEX_METRIKA_ID в .env,
  // иначе используется счётчик по умолчанию (важно для CI, где .env отсутствует)
  const metrikaId = env.VITE_YANDEX_METRIKA_ID || '112322375';
  const rtbId = env.VITE_YANDEX_RTB_BLOCK_ID || '';
  return {
    name: 'env-replace',
    transformIndexHtml: {
      // order: 'pre' — подставляем значения ДО того, как Vite начнёт разбирать HTML:
      // последовательности %...% в URL-атрибутах иначе ломают его decodeURI
      order: 'pre',
      handler(html) {
        return html
          .replace(/%VITE_YANDEX_METRIKA_ID%/g, metrikaId)
          .replace(/%VITE_YANDEX_RTB_BLOCK_ID%/g, rtbId);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
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
