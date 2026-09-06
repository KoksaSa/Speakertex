// Автономная сборка Speakertex в ОДИН html-файл.
// Весь JS/CSS инлайнится в index.html — такой файл открывается
// двойным кликом по file:// без локального сервера и без интернета
// (обычная Vite-сборка по file:// не работает: браузер блокирует
// внешние module-скрипты из-за CORS).
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { envReplacePlugin } from './vite.config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [react(), envReplacePlugin(env), viteSingleFile()],
    build: {
      outDir: 'dist-standalone',
      emptyOutDir: true,
    },
  };
});
