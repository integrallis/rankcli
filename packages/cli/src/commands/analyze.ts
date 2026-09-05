import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

interface AnalyzeOptions {
  verbose?: boolean;
}

interface AnalysisResult {
  projectName: string;
  framework: string | null;
  hasReadme: boolean;
  readmeSummary: string | null;
  pageCount: number;
  hasMetaTags: boolean;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  keywords: string[];
  suggestions: string[];
}

const CONTENT_EXTENSIONS = ['.md', '.mdx', '.html', '.tsx', '.jsx', '.vue', '.astro', '.svelte'];

function findFiles(dir: string, extensions: string[], maxDepth = 3, depth = 0): string[] {
  if (depth > maxDepth) return [];

  const files: string[] = [];

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules' || item === 'dist' || item === 'build') {
        continue;
      }

      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath, extensions, maxDepth, depth + 1));
      } else if (extensions.includes(extname(item))) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore permission errors
  }

  return files;
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production would use NLP
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const frequency: Record<string, number> = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  // Filter out common words
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'will', 'would',
    'could', 'should', 'their', 'there', 'about', 'which', 'when', 'what',
    'your', 'more', 'some', 'just', 'into', 'over', 'such', 'only', 'than',
    'them', 'then', 'these', 'most', 'other', 'also', 'being', 'after',
    'const', 'function', 'return', 'import', 'export', 'default', 'true', 'false',
  ]);

  return Object.entries(frequency)
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function loadConfig(): { name: string; framework: string | null } | null {
  const configPath = join(process.cwd(), 'rankcli.config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return null;
    }
  }
  return null;
}

export async function analyze(options: AnalyzeOptions): Promise<void> {
  console.log('\n🔍 Analyzing project for SEO opportunities...\n');

  const cwd = process.cwd();
  const config = loadConfig();

  const result: AnalysisResult = {
    projectName: config?.name || cwd.split('/').pop() || 'unknown',
    framework: config?.framework || null,
    hasReadme: false,
    readmeSummary: null,
    pageCount: 0,
    hasMetaTags: false,
    hasSitemap: false,
    hasRobotsTxt: false,
    keywords: [],
    suggestions: [],
  };

  // Check for README
  const readmePaths = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];
  for (const rp of readmePaths) {
    if (existsSync(join(cwd, rp))) {
      result.hasReadme = true;
      const content = readFileSync(join(cwd, rp), 'utf-8');
      result.readmeSummary = content.slice(0, 200).replace(/\n/g, ' ').trim() + '...';
      result.keywords.push(...extractKeywords(content));
      break;
    }
  }

  // Check for common SEO files
  result.hasSitemap = existsSync(join(cwd, 'public', 'sitemap.xml')) ||
                       existsSync(join(cwd, 'sitemap.xml'));
  result.hasRobotsTxt = existsSync(join(cwd, 'public', 'robots.txt')) ||
                         existsSync(join(cwd, 'robots.txt'));

  // Find content files
  const contentFiles = findFiles(cwd, CONTENT_EXTENSIONS);
  result.pageCount = contentFiles.length;

  // Check for meta tags in key files
  const htmlFiles = contentFiles.filter(f => f.endsWith('.html') || f.includes('_document') || f.includes('layout'));
  for (const hf of htmlFiles.slice(0, 5)) {
    const content = readFileSync(hf, 'utf-8');
    if (content.includes('<meta') || content.includes('metadata')) {
      result.hasMetaTags = true;
      break;
    }
  }

  // Extract more keywords from content files
  for (const cf of contentFiles.slice(0, 10)) {
    const content = readFileSync(cf, 'utf-8');
    result.keywords.push(...extractKeywords(content));
  }

  // Deduplicate keywords
  result.keywords = [...new Set(result.keywords)].slice(0, 20);

  // Generate suggestions
  if (!result.hasReadme) {
    result.suggestions.push('Add a README.md with clear project description');
  }
  if (!result.hasSitemap) {
    result.suggestions.push('Generate a sitemap.xml for better crawlability');
  }
  if (!result.hasRobotsTxt) {
    result.suggestions.push('Add robots.txt to guide search engine crawlers');
  }
  if (!result.hasMetaTags) {
    result.suggestions.push('Add meta tags (title, description, og:*) to pages');
  }
  if (result.pageCount < 5) {
    result.suggestions.push('Consider adding more content pages for SEO coverage');
  }

  // Output results
  console.log('📊 Analysis Results\n');
  console.log(`Project: ${result.projectName}`);
  console.log(`Framework: ${result.framework || 'Unknown'}`);
  console.log(`Content files: ${result.pageCount}`);
  console.log(`Has README: ${result.hasReadme ? '✅' : '❌'}`);
  console.log(`Has sitemap.xml: ${result.hasSitemap ? '✅' : '❌'}`);
  console.log(`Has robots.txt: ${result.hasRobotsTxt ? '✅' : '❌'}`);
  console.log(`Has meta tags: ${result.hasMetaTags ? '✅' : '❌'}`);

  if (result.keywords.length > 0) {
    console.log('\n🔑 Detected Keywords:');
    console.log(`   ${result.keywords.join(', ')}`);
  }

  if (result.suggestions.length > 0) {
    console.log('\n💡 Suggestions:');
    for (const s of result.suggestions) {
      console.log(`   • ${s}`);
    }
  } else {
    console.log('\n✅ No critical SEO issues found!');
  }

  console.log('\n📈 Next: Run "rankcli audit --url <your-deployed-site>" for a full technical audit\n');
}
