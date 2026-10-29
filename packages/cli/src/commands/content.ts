// Content Analysis CLI Command
// Analyze content for readability, keyword density, and featured snippet potential

import {
  analyzeReadability,
  formatReadabilityReport,
  classifyIntent,
  formatIntentReport,
  analyzeHeadline,
  formatHeadlineReport,
  generateHeadlineVariations,
  analyzeFeaturedSnippetPotential,
  formatFeaturedSnippetReport,
  analyzeKeywordDensity,
  formatKeywordDensityReport,
  crawlUrl,
  extractMeta,
  analyzeHeadings,
  type CrawlResult,
  type MetaData,
  type HeadingStructure,
} from '@rankcli/agent-runtime';

interface ContentOptions {
  url?: string;
  keyword?: string;
  headline?: string;
  mode?: 'full' | 'readability' | 'headline' | 'snippet' | 'density';
}

export async function analyzeContent(options: ContentOptions): Promise<void> {
  console.log('\n📝 RankCLI - Content Analysis\n');

  const mode = options.mode || 'full';

  // If headline-only mode
  if (mode === 'headline' || options.headline) {
    const headline = options.headline || '';
    if (!headline) {
      console.log('❌ Please provide a headline with --headline "Your Headline Here"');
      return;
    }

    const analysis = analyzeHeadline(headline);
    console.log(formatHeadlineReport(analysis));

    // Generate variations
    if (options.keyword) {
      console.log('\n📋 HEADLINE VARIATIONS');
      console.log('─'.repeat(60));
      const variations = generateHeadlineVariations(options.keyword, [options.keyword]);
      for (const v of variations.slice(0, 5)) {
        console.log(`  • ${v}`);
      }
      console.log('');
    }
    return;
  }

  // If URL provided, fetch content
  if (options.url) {
    console.log(`Fetching content from ${options.url}...`);

    try {
      const crawlResult = await crawlUrl({ url: options.url });

      if (!crawlResult.success || !crawlResult.data) {
        console.log('❌ Could not fetch content from URL');
        return;
      }
      const { html } = crawlResult.data as CrawlResult;

      const [metaResult, headingsResult] = await Promise.all([
        extractMeta({ html, url: options.url }),
        analyzeHeadings({ html }),
      ]);
      const meta = metaResult.success ? (metaResult.data as MetaData) : undefined;
      const headingStructure = headingsResult.success ? (headingsResult.data as HeadingStructure[]) : [];

      // Extract content elements
      const title = meta?.title || '';
      const h1 = headingStructure.find(h => h.level === 1)?.text || '';
      const headings = headingStructure.map(h => h.text);
      const bodyText = extractBodyText(html);
      const paragraphs = bodyText.split(/\n\n+/);

      console.log(`\nAnalyzing: "${title || options.url}"\n`);

      // Run analyses based on mode
      if (mode === 'full' || mode === 'readability') {
        const readability = analyzeReadability(bodyText);
        console.log(formatReadabilityReport(readability));
      }

      if (mode === 'full' && title) {
        const headlineAnalysis = analyzeHeadline(title);
        console.log(formatHeadlineReport(headlineAnalysis));
      }

      if (options.keyword && (mode === 'full' || mode === 'density')) {
        const densityAnalysis = analyzeKeywordDensity(options.keyword, {
          title,
          h1,
          headings,
          body: bodyText,
          firstParagraph: paragraphs[0],
          lastParagraph: paragraphs[paragraphs.length - 1],
        });
        console.log(formatKeywordDensityReport(densityAnalysis));
      }

      if (options.keyword && (mode === 'full' || mode === 'snippet')) {
        const snippetAnalysis = analyzeFeaturedSnippetPotential(
          options.keyword,
          bodyText,
          headings
        );
        console.log(formatFeaturedSnippetReport(snippetAnalysis));
      }

      // Intent analysis for keyword
      if (options.keyword) {
        const intentAnalysis = classifyIntent(options.keyword);
        console.log(formatIntentReport(options.keyword, intentAnalysis));
      }

      // Summary stats
      console.log('\n📊 CONTENT SUMMARY');
      console.log('─'.repeat(60));
      console.log(`  Title:      ${title || '(none)'}`);
      console.log(`  H1:         ${h1 || '(none)'}`);
      console.log(`  Word Count: ${bodyText.split(/\s+/).length}`);
      console.log(`  Headings:   ${headings.length}`);
      console.log('');

    } catch (error) {
      console.log(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  } else {
    // Show usage
    console.log('Usage:');
    console.log('  seo content -u <url>                    Full content analysis');
    console.log('  seo content -u <url> -k "keyword"       Analyze with target keyword');
    console.log('  seo content --headline "Your Title"     Analyze headline only');
    console.log('  seo content -u <url> --mode readability Readability only');
    console.log('  seo content -u <url> -k "kw" --mode density   Keyword density only');
    console.log('  seo content -u <url> -k "kw" --mode snippet   Featured snippet analysis');
    console.log('');
  }
}

// Quick intent classification
export async function analyzeIntent(keyword: string): Promise<void> {
  console.log('\n🔍 Search Intent Analysis\n');

  const analysis = classifyIntent(keyword);
  console.log(formatIntentReport(keyword, analysis));
}

// Extract plain text from HTML
function extractBodyText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Block elements end a paragraph: without this every page was one paragraph, however long.
  text = text.replace(/<\/(p|li|h[1-6]|blockquote|pre|tr)>|<br\s*\/?>/gi, '\n\n');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  // Normalize whitespace, keeping paragraph breaks
  text = text.replace(/[ \t\r\f\v]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
