# Releasing the GitHub Action

This package lives in the private RankCLI monorepo. The consumable action is the public repo
[`integrallis/rankcli-action`](https://github.com/integrallis/rankcli-action), which holds
`action.yml`, `README.md`, `LICENSE`, the action's `src/` (without tests) and the built `dist/`.
To stage a release there:

```bash
git clone git@github.com:integrallis/rankcli-action.git ~/src/rankcli-action
packages/github-action/scripts/publish-action.sh ~/src/rankcli-action 1.0.0
```

The script builds and tests the action, copies it into the clone, commits, tags `v1.0.0` and
moves `v1`. It prints the push commands and pushes nothing itself. The first time, draft a
GitHub release for the tag and tick "Publish this Action to the GitHub Marketplace".

Before each release, the bundle must not contain premium checks or secrets: `dist.test.ts`
checks that, and the script refuses to stage a bundle that fails it.
