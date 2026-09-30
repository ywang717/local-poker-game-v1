import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8')) as Record<string, unknown>;
}

describe('PWA release assets', () => {
  it('defines an installable Chinese standalone app', () => {
    const manifest = readManifest();
    expect(manifest.name).toBe('本地德州扑克生涯');
    expect(manifest.short_name).toBe('本地德州扑克');
    expect(manifest.lang).toBe('zh-CN');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.theme_color).toBe('#FFFFFF');
    expect(manifest.background_color).toBe('#FFFFFF');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: 'pwa-192x192.png', sizes: '192x192' }),
      expect.objectContaining({ src: 'pwa-512x512.png', sizes: '512x512' }),
    ]));
  });

  it('provides a browser favicon without a missing resource request', () => {
    const favicon = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(favicon).toContain('<svg');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('%BASE_URL%favicon.svg');
  });

  it('provides a Pages deployment workflow with the required build steps', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('actions/configure-pages');
    expect(workflow).toContain('actions/upload-pages-artifact');
    expect(workflow).toContain('actions/deploy-pages');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run build');
  });

  it('documents the public link and device-specific install steps', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    expect(readme).toContain('https://ywang717.github.io/local-poker-game-v1/');
    expect(readme).toContain('iPhone Safari');
    expect(readme).toContain('Android Chrome');
    expect(readme).toContain('各设备独立');
    expect(readme).toContain('Settings → Pages');
  });
});
