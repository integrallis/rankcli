// Placeholder checks for development builds
// In production, this is replaced with the full 280+ checks from ../dist/index.mjs

globalThis.RankCLI = {
  runAudit: function(url, html, checksLimit) {
    const issues = [];

    // Basic title check
    if (!html.includes('<title>') || html.includes('<title></title>')) {
      issues.push({
        code: 'MISSING_TITLE',
        severity: 'error',
        category: 'on-page',
        title: 'Missing or empty title tag',
        description: 'Every page should have a unique, descriptive title tag.'
      });
    }

    // Basic meta description check
    if (!html.includes('meta name="description"') && !html.includes("meta name='description'")) {
      issues.push({
        code: 'MISSING_META_DESCRIPTION',
        severity: 'warning',
        category: 'on-page',
        title: 'Missing meta description',
        description: 'Add a meta description to improve click-through rates from search results.'
      });
    }

    // Basic OG tags check
    if (!html.includes('og:title')) {
      issues.push({
        code: 'MISSING_OG_TITLE',
        severity: 'warning',
        category: 'social',
        title: 'Missing Open Graph title',
        description: 'Add og:title for better social media sharing.'
      });
    }

    return {
      success: true,
      score: Math.max(0, 100 - (issues.length * 10)),
      issues: issues,
      checksRun: 3,
      tier: checksLimit > 100 ? 'paid' : checksLimit > 50 ? 'registered' : 'free'
    };
  }
};
