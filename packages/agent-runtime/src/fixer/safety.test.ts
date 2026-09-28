import { describe, it, expect } from 'vitest';
import { assessReplacement, describeConcerns } from './safety.js';

const codes = (path: string, original: string | null, replacement: string) =>
  assessReplacement(path, original, replacement).map((c) => c.code);

const PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Integrallis — Independent AI research</title>
    <meta name="google-site-verification" content="abc123">
    <link rel="stylesheet" href="assets/css/styles.css">
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body><h1>Hello</h1></body>
</html>`;

describe('assessReplacement', () => {
  it('passes a change that only adds', () => {
    const improved = PAGE.replace('</head>', '  <meta name="description" content="x">\n  </head>');
    expect(codes('index.html', PAGE, improved)).toEqual([]);
  });

  it('refuses to lose the app entry point', () => {
    const broken = PAGE.replace('<script type="module" src="/src/main.tsx"></script>', '');
    expect(codes('index.html', PAGE, broken)).toContain('lost_script');
  });

  it('refuses to lose a stylesheet', () => {
    const broken = PAGE.replace('<link rel="stylesheet" href="assets/css/styles.css">', '');
    expect(codes('index.html', PAGE, broken)).toContain('lost_stylesheet');
  });

  // Dropping this can un-verify a Search Console property, and the page can't tell you it's gone.
  it('refuses to lose a site-verification tag', () => {
    const broken = PAGE.replace('<meta name="google-site-verification" content="abc123">', '');
    expect(codes('index.html', PAGE, broken)).toContain('lost_verification');
  });

  it('refuses a truncated page', () => {
    expect(codes('index.html', PAGE, '<html><head><title>x</title></head>')).toEqual(
      expect.arrayContaining(['shrunk', 'lost_closing_tag'])
    );
  });

  it('refuses invalid JSON-LD, even in a file being created', () => {
    const bad = '<head><script type="application/ld+json">{"@type": }</script></head>';
    expect(codes('index.html', null, bad)).toContain('invalid_json_ld');
  });

  it('accepts valid JSON-LD', () => {
    const good = '<head><script type="application/ld+json">{"@type":"WebSite"}</script></head>';
    expect(codes('index.html', null, good)).toEqual([]);
  });

  it('refuses malformed JSON in a config file', () => {
    expect(codes('vercel.json', '{"a":1}', '{"a":1,}')).toContain('invalid_json');
    expect(codes('site.webmanifest', null, '{"name":"ok"}')).toEqual([]);
  });

  it('refuses malformed XML', () => {
    expect(codes('sitemap.xml', null, '<urlset><url><loc>x</loc></urlset>')).toContain('invalid_xml');
    expect(codes('sitemap.xml', null, '<?xml version="1.0"?><urlset><url><loc>x</loc></url></urlset>')).toEqual([]);
  });

  it('refuses to lose an import from a source file', () => {
    const before = "import { x } from './x.js';\nimport y from 'y';\nexport const a = 1;";
    const after = "import { x } from './x.js';\nexport const a = 2;";
    expect(codes('src/page.tsx', before, after)).toContain('lost_import');
  });

  describe('sitemaps', () => {
    const before = `<?xml version="1.0"?><urlset>
      <url><loc>https://x.com/</loc><lastmod>2026-09-15</lastmod></url>
      <url><loc>https://x.com/a</loc><lastmod>2026-09-15</lastmod></url>
    </urlset>`;

    it('refuses to drop URLs', () => {
      const fewer = `<?xml version="1.0"?><urlset>
        <url><loc>https://x.com/</loc><lastmod>2026-09-15</lastmod></url>
      </urlset>`;
      expect(codes('sitemap.xml', before, fewer)).toContain('fewer_sitemap_urls');
    });

    // The real regression a model produced: lastmod rewritten two years into the past.
    it('refuses a lastmod moved backwards', () => {
      const stale = before.replace(/2026-09-15/g, '2024-07-26');
      expect(codes('sitemap.xml', before, stale)).toContain('lastmod_moved_backwards');
    });

    it('accepts a lastmod moved forward', () => {
      const fresher = before.replace(/2026-09-15/g, '2026-09-27');
      expect(codes('sitemap.xml', before, fresher)).toEqual([]);
    });

    it('accepts added URLs', () => {
      const more = before.replace(
        '</urlset>',
        '<url><loc>https://x.com/b</loc><lastmod>2026-09-15</lastmod></url></urlset>'
      );
      expect(codes('sitemap.xml', before, more)).toEqual([]);
    });
  });

  it('has nothing to say about a new plain file', () => {
    expect(codes('robots.txt', null, 'User-agent: *\nAllow: /')).toEqual([]);
  });

  it('describes concerns for a log line', () => {
    const concerns = assessReplacement('index.html', PAGE, '<html><head></head>');
    expect(describeConcerns(concerns)).toMatch(/shrunk|lost_closing_tag/);
  });
});

// Both of these come from a real generated PR against rankcli.dev (#11), reviewed before it
// was merged. It would have deindexed the site and published a phone number and street
// address that do not exist.
describe('invented content', () => {
  const SHELL = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';

  it('flags a fabricated phone number and address', () => {
    const ld = `<script type="application/ld+json">{"@type":"Organization","telephone":"+1-800-555-0199","address":{"streetAddress":"123 Main Street","addressLocality":"Anytown"}}</script>`;
    const codes = assessReplacement('index.html', SHELL, SHELL.replace('</head>', `${ld}</head>`)).map((c) => c.code);
    expect(codes).toContain('placeholder_content');
  });

  it('flags an unfilled your_... placeholder', () => {
    const codes = assessReplacement(
      'index.html',
      SHELL,
      SHELL.replace('</head>', '<link rel="me" href="https://youtube.com/channel/your_youtube_channel"></head>')
    ).map((c) => c.code);
    expect(codes).toContain('placeholder_content');
  });

  it('does not blame us for a placeholder that was already there', () => {
    const withPlaceholder = SHELL.replace('</head>', '<meta name="x" content="Anytown"></head>');
    const codes = assessReplacement('index.html', withPlaceholder, withPlaceholder + '<!-- edited -->').map((c) => c.code);
    expect(codes).not.toContain('placeholder_content');
  });

  it('flags a canonical added to a single-page-app shell', () => {
    const codes = assessReplacement(
      'index.html',
      SHELL,
      SHELL.replace('</head>', '<link rel="canonical" href="https://example.dev/"></head>')
    ).map((c) => c.code);
    expect(codes).toContain('canonical_in_shared_shell');
  });

  it('allows a canonical on a real single page', () => {
    const page = '<html><head><title>x</title></head><body><h1>About</h1></body></html>';
    const codes = assessReplacement(
      'about.html',
      page,
      page.replace('</head>', '<link rel="canonical" href="https://example.dev/about"></head>')
    ).map((c) => c.code);
    expect(codes).not.toContain('canonical_in_shared_shell');
  });

  it('leaves ordinary real content alone', () => {
    const page = '<html><head><title>x</title></head><body><p>Call +1-480-463-4962</p></body></html>';
    expect(assessReplacement('about.html', page, page + '<!-- ok -->').map((c) => c.code)).toEqual([]);
  });
});
