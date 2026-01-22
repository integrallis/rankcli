import { runFullAudit, formatReport, type AuditReport } from '@rankcli/agent-runtime';

interface AuditOptions {
  url?: string;
  output?: string;
  checkLinks?: boolean;
}

export async function audit(options: AuditOptions): Promise<void> {
  const url = options.url;

  if (!url) {
    console.log('\n⚠️  Please provide a URL to audit:');
    console.log('   seo audit --url https://your-site.com\n');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.log('\n❌ Invalid URL format. Please provide a valid URL.\n');
    return;
  }

  try {
    const report = await runFullAudit({
      url,
      checkBrokenLinks: options.checkLinks || false,
    });

    if (options.output === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatReport(report));
    }

  } catch (error) {
    console.log(`\n❌ Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
}
