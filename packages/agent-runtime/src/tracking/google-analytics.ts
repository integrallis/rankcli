// Google Analytics 4 Integration
// Auto-inject GA4 tracking code into web projects

import * as fs from 'fs';
import * as path from 'path';

export interface GA4Config {
  measurementId: string; // G-XXXXXXXXXX
}

export interface InjectionResult {
  success: boolean;
  file?: string;
  message: string;
  code?: string;
}

/**
 * Generate GA4 tracking script
 */
export function generateGA4Script(config: GA4Config): string {
  return `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${config.measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${config.measurementId}');
</script>`;
}

/**
 * Generate GA4 for React/Next.js (component-based)
 */
export function generateGA4ReactComponent(config: GA4Config): string {
  return `// components/GoogleAnalytics.tsx
import Script from 'next/script';

export function GoogleAnalytics() {
  const measurementId = '${config.measurementId}';

  return (
    <>
      <Script
        src={\`https://www.googletagmanager.com/gtag/js?id=\${measurementId}\`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {\`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '\${measurementId}');
        \`}
      </Script>
    </>
  );
}`;
}

/**
 * Generate GA4 for Vite/vanilla (index.html injection)
 */
export function generateGA4ViteScript(config: GA4Config): string {
  return `    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${config.measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${config.measurementId}');
    </script>`;
}

/**
 * Simple framework detection for tracking injection
 */
function detectFrameworkSimple(projectPath: string): string {
  // Check for Next.js
  if (fs.existsSync(path.join(projectPath, 'next.config.js')) ||
      fs.existsSync(path.join(projectPath, 'next.config.ts')) ||
      fs.existsSync(path.join(projectPath, 'next.config.mjs'))) {
    return 'nextjs';
  }

  // Check for Vite
  if (fs.existsSync(path.join(projectPath, 'vite.config.js')) ||
      fs.existsSync(path.join(projectPath, 'vite.config.ts'))) {
    return 'vite';
  }

  // Check for plain HTML
  if (fs.existsSync(path.join(projectPath, 'index.html'))) {
    return 'html';
  }

  // Check for React (CRA)
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        return 'react';
      }
    } catch {
      // Ignore parse errors
    }
  }

  return 'unknown';
}

/**
 * Auto-detect framework and inject GA4
 */
export async function injectGA4(projectPath: string, config: GA4Config): Promise<InjectionResult> {
  const framework = detectFrameworkSimple(projectPath);

  switch (framework) {
    case 'nextjs':
      return injectGA4NextJs(projectPath, config);
    case 'vite':
    case 'react':
      return injectGA4Vite(projectPath, config);
    case 'html':
      return injectGA4Html(projectPath, config);
    default:
      return {
        success: false,
        message: `Unsupported framework: ${framework}. Please manually add GA4.`,
        code: generateGA4Script(config),
      };
  }
}

async function injectGA4NextJs(projectPath: string, config: GA4Config): Promise<InjectionResult> {
  // Check for app directory (App Router) or pages directory (Pages Router)
  const appLayoutPath = path.join(projectPath, 'app', 'layout.tsx');
  const pagesAppPath = path.join(projectPath, 'pages', '_app.tsx');
  const srcAppLayoutPath = path.join(projectPath, 'src', 'app', 'layout.tsx');
  const srcPagesAppPath = path.join(projectPath, 'src', 'pages', '_app.tsx');

  // Try App Router first
  for (const layoutPath of [appLayoutPath, srcAppLayoutPath]) {
    if (fs.existsSync(layoutPath)) {
      const content = fs.readFileSync(layoutPath, 'utf-8');

      // Check if GA4 already exists
      if (content.includes('googletagmanager.com/gtag')) {
        return { success: true, file: layoutPath, message: 'GA4 already installed' };
      }

      // Create GoogleAnalytics component
      const componentsDir = path.join(path.dirname(layoutPath), '..', 'components');
      if (!fs.existsSync(componentsDir)) {
        fs.mkdirSync(componentsDir, { recursive: true });
      }

      const gaComponentPath = path.join(componentsDir, 'GoogleAnalytics.tsx');
      fs.writeFileSync(gaComponentPath, generateGA4ReactComponent(config));

      // Update layout to import and use component
      const importStatement = `import { GoogleAnalytics } from '@/components/GoogleAnalytics';\n`;
      const componentUsage = '<GoogleAnalytics />';

      // Add import at top
      let newContent = content;
      if (!newContent.includes('GoogleAnalytics')) {
        // Find first import or add at top
        const importMatch = newContent.match(/^import .+$/m);
        if (importMatch) {
          newContent = newContent.replace(importMatch[0], importMatch[0] + '\n' + importStatement);
        } else {
          newContent = importStatement + newContent;
        }

        // Add component inside <head> or <body>
        if (newContent.includes('<head>')) {
          newContent = newContent.replace('<head>', `<head>\n        ${componentUsage}`);
        } else if (newContent.includes('<body')) {
          newContent = newContent.replace(/<body([^>]*)>/, `<body$1>\n        ${componentUsage}`);
        }

        fs.writeFileSync(layoutPath, newContent);
      }

      return {
        success: true,
        file: layoutPath,
        message: `GA4 component created at ${gaComponentPath} and imported in layout`,
      };
    }
  }

  // Try Pages Router
  for (const appPath of [pagesAppPath, srcPagesAppPath]) {
    if (fs.existsSync(appPath)) {
      return {
        success: false,
        file: appPath,
        message: 'Pages Router detected. Please manually add GA4 to _app.tsx',
        code: generateGA4ReactComponent(config),
      };
    }
  }

  return {
    success: false,
    message: 'Could not find Next.js layout or _app file',
    code: generateGA4ReactComponent(config),
  };
}

async function injectGA4Vite(projectPath: string, config: GA4Config): Promise<InjectionResult> {
  // Look for index.html
  const indexPaths = [
    path.join(projectPath, 'index.html'),
    path.join(projectPath, 'public', 'index.html'),
    path.join(projectPath, 'src', 'index.html'),
  ];

  for (const indexPath of indexPaths) {
    if (fs.existsSync(indexPath)) {
      let content = fs.readFileSync(indexPath, 'utf-8');

      // Check if already installed
      if (content.includes('googletagmanager.com/gtag')) {
        return { success: true, file: indexPath, message: 'GA4 already installed' };
      }

      // Inject before </head>
      const ga4Script = generateGA4ViteScript(config);
      content = content.replace('</head>', `${ga4Script}\n  </head>`);

      fs.writeFileSync(indexPath, content);
      return {
        success: true,
        file: indexPath,
        message: `GA4 injected into ${indexPath}`,
      };
    }
  }

  return {
    success: false,
    message: 'Could not find index.html',
    code: generateGA4Script(config),
  };
}

async function injectGA4Html(projectPath: string, config: GA4Config): Promise<InjectionResult> {
  return injectGA4Vite(projectPath, config); // Same logic
}

/**
 * Generate environment variable template for GA4
 */
export function generateGA4EnvTemplate(): string {
  return `# Google Analytics 4
# Get your Measurement ID from: https://analytics.google.com
# Go to: Admin > Data Streams > Your Stream > Measurement ID
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX
# or for Next.js:
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX`;
}
