import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
const base = isGitHubPagesBuild ? '/local-poker-game-v1/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: '本地德州扑克生涯',
        short_name: '本地德州扑克',
        description: '完全离线的中文单人德州扑克生涯游戏',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        id: './',
        display: 'standalone',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
