import { describe, expect, it } from 'vitest';
import { analyzePlatformPresence } from './platform-presence.js';

describe('analyzePlatformPresence findings', () => {
  it('no longer reports a missing YouTube channel or missing embeds', () => {
    const html = '<html><body><p>Acme.</p><footer><a href="https://github.com/acme">GitHub</a><a href="https://x.com/acme">X</a><a href="https://bsky.app/profile/acme.dev">Bluesky</a></footer></body></html>';
    const { issues } = analyzePlatformPresence(html, 'https://acme.dev/');
    const codes = issues.map((i) => i.code);
    expect(codes).not.toContain('NO_YOUTUBE_PRESENCE');
    expect(codes).not.toContain('NO_EMBEDDED_SOCIAL');
  });
});
