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

  it('provides a Pages deployment workflow with the required build steps', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('actions/configure-pages');
    expect(workflow).toContain('actions/upload-pages-artifact');
    expect(workflow).toContain('actions/deploy-pages');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run build');
  });
});
