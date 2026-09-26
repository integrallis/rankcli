// Writing the generated CI files to disk. Node-only: the template half lives in
// ./github-action-template.ts, which the Deno edge-function bundle imports - keeping
// `require('fs')` in this file is what lets that bundle exist at all (esbuild pulls in
// whatever the module it is given touches, so one file with both halves made the
// generator unbundleable for Deno).
import { generateWorkflow, generateSecretsDoc, type WorkflowConfig } from './github-action-template.js';

export * from './github-action-template.js';

/**
 * Write GitHub Action files to project
 */
export function writeGitHubActionFiles(
  projectPath: string,
  config: WorkflowConfig
): { files: string[]; instructions: string } {
  const fs = require('fs');
  const path = require('path');

  const files: string[] = [];

  // Create .github/workflows directory
  const workflowDir = path.join(projectPath, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }

  // Write workflow file
  const workflowPath = path.join(workflowDir, 'seo.yml');
  fs.writeFileSync(workflowPath, generateWorkflow(config));
  files.push(workflowPath);

  // Write secrets documentation
  const docsDir = path.join(projectPath, '.github');
  const secretsDocPath = path.join(docsDir, 'SEO_SETUP.md');
  fs.writeFileSync(secretsDocPath, generateSecretsDoc(config));
  files.push(secretsDocPath);

  const instructions = config.syncToDashboard
    ? `
GitHub Action created! Next steps:

1. Add the RANKCLI_API_KEY secret to your repository:
   Settings > Secrets and variables > Actions
   Get a key at https://rankcli.dev/account?tab=api-keys
   See .github/SEO_SETUP.md for details

2. The workflow will run ${config.schedule}
   Or trigger manually: Actions > RankCLI SEO Check > Run workflow
`
    : `
GitHub Action created! No secrets required to run as-is.

1. Commit and push .github/workflows/seo.yml
2. The workflow will run ${config.schedule}
   Or trigger manually: Actions > RankCLI SEO Check > Run workflow
3. Want audits on your RankCLI dashboard too? Re-run
   \`rankcli setup --github-action\` and opt in - see .github/SEO_SETUP.md
`;

  return { files, instructions };
}
