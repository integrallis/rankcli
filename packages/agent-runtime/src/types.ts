export interface AgentDefinition {
  name: string;
  description: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: AgentTool[];
  system: string;
  prompt: string;
}

export interface AgentTool {
  name: string;
  description: string;
}

export interface SEOIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'meta' | 'schema' | 'content' | 'technical' | 'performance' | 'social' | 'accessibility';
  code: string;
  message: string;
  impact: string;
  element?: string;
  fix?: {
    file: string;
    before: string | null;
    after: string;
  };
}

export interface SEOAnalysisResult {
  url: string;
  score: number;
  core_web_vitals?: {
    lcp?: { value: string; status: 'good' | 'needs-improvement' | 'poor' };
    fid?: { value: string; status: 'good' | 'needs-improvement' | 'poor' };
    cls?: { value: string; status: 'good' | 'needs-improvement' | 'poor' };
  };
  issues: SEOIssue[];
  recommendations: SEORecommendation[];
}

export interface SEORecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  impact: string;
}

export interface CrawlResult {
  url: string;
  html: string;
  statusCode: number;
  headers: Record<string, string>;
  loadTime: number;
}

export interface MetaData {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  viewport?: string;
  charset?: string;
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    siteName?: string;
  };
  twitter: {
    card?: string;
    title?: string;
    description?: string;
    image?: string;
    site?: string;
  };
  other: Record<string, string>;
}

export interface HeadingStructure {
  tag: string;
  text: string;
  level: number;
}

export interface ImageInfo {
  src: string;
  alt: string | null;
  width?: string;
  height?: string;
  loading?: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  isInternal: boolean;
  isNofollow: boolean;
}

export interface SchemaData {
  type: string;
  data: Record<string, unknown>;
}

export interface FrameworkInfo {
  name: string;
  version?: string;
  router?: 'app' | 'pages' | 'file-based' | 'custom';
  language?: 'javascript' | 'typescript' | 'ruby' | 'python' | 'php' | 'java' | 'csharp' | 'go' | 'elixir' | 'rust';
  metaPattern: 
    | 'metadata-export'    // Next.js App Router
    | 'head-component'     // React, Vue, Svelte
    | 'frontmatter'        // Astro, Hugo, Jekyll, Eleventy
    | 'meta-function'      // Remix
    | 'html-head'          // Plain HTML
    | 'erb-helpers'        // Rails with meta-tags gem
    | 'blade-components'   // Laravel Blade
    | 'thymeleaf'          // Spring Boot
    | 'razor'              // ASP.NET Core
    | 'heex'               // Phoenix/Elixir
    | 'go-templates'       // Go (Gin/Echo/Fiber)
    | 'django-templates'   // Django/Jinja2
    | 'server-rendered';   // HTMX and other server-rendered
}

export interface Fix {
  issue: {
    code: string;
    message: string;
    severity: string;
  };
  file: string;
  before: string | null;
  after: string;
  explanation: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type ToolFunction = (params: Record<string, unknown>) => Promise<ToolResult>;
