import { describe, it, expect } from 'vitest';
import { analyzePlatformPresence } from './platform-presence.js';

const page = (footer: string) =>
  `<html><body><main><p>Acme is a linter for websites.</p></main><footer>${footer}</footer></body></html>`;

describe('analyzePlatformPresence: developer platforms', () => {
  it('counts Bluesky, Dev.to and Mastodon profile links as social profiles', () => {
    const { issues, data } = analyzePlatformPresence(
      page(
        '<a href="https://bsky.app/profile/acme.bsky.social">Bluesky</a>' +
          '<a href="https://dev.to/acme">Dev.to</a>' +
          '<a href="https://fosstodon.org/@acme">Mastodon</a>'
      ),
      'https://acme.dev/'
    );
    expect(data.detectedPlatforms).toEqual(expect.arrayContaining(['Bluesky', 'Dev.to', 'Mastodon']));
    expect(data.socialProfiles.map((p) => p.platform)).toEqual(
      expect.arrayContaining(['Bluesky', 'Dev.to', 'Mastodon'])
    );
    expect(issues.map((i) => i.code)).not.toContain('NO_SOCIAL_PROFILES');
  });

  it('still reports no profiles when the only platform link is a GitHub repository', () => {
    const { issues } = analyzePlatformPresence(
      page('<a href="https://github.com/acme/acme-cli">Source</a>'),
      'https://acme.dev/'
    );
    expect(issues.map((i) => i.code)).toContain('NO_SOCIAL_PROFILES');
  });
});
