// Tracking & Monitoring Module
// Google Analytics, Search Console integration, and automated reporting

// Google Analytics 4
export {
  generateGA4Script,
  generateGA4ReactComponent,
  generateGA4ViteScript,
  generateGA4EnvTemplate,
  injectGA4,
  type GA4Config,
  type InjectionResult,
} from './google-analytics.js';

// Google Search Console
export {
  generateGSCVerificationTag,
  injectGSCVerification,
  buildGSCApiRequest,
  parseGSCResponse,
  identifyQuickWins,
  comparePeriods,
  getGSCSetupInstructions,
  type GSCConfig,
  type GSCCredentials,
  type GSCQueryResult,
  type GSCPerformanceData,
  type QuickWin,
} from './search-console.js';

// GitHub Action
export {
  generateWorkflow,
  generateSecretsDoc,
  generateGitHubActionSetup,
  writeGitHubActionFiles,
  type WorkflowConfig,
} from './github-action.js';

// Report Generator
export {
  generateMarkdownReport,
  generateJsonReport,
  type ReportData,
} from './report-generator.js';
