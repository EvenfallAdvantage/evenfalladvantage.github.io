# Branch protection / ruleset proposal (NOT applied)

## Current state of `main`
Classic protection: 1 required approval, stale reviews dismissed, required check **gitleaks** only, `enforce_admins` **off**, force pushes blocked. No rulesets. The repo is public and owned by the user account `EvenfallAdvantage`.

**Problem:** every PR is authored by the same account that owns the repo, and GitHub never lets authors approve their own PRs. So the approval rule can only be met by an admin bypass (`--admin`), which leaves no independent review on record.

## Proposal
1. **Second identity for automation.** Create a machine account (e.g. `evenfall-bot`, collaborator with Write) or a GitHub App. Agents open PRs as that identity, and the owner approves as `EvenfallAdvantage`. That gives a real two-party review.
2. **Ruleset** (replaces classic protection) at https://github.com/EvenfallAdvantage/evenfalladvantage.github.io/settings/rules → *New branch ruleset*:
   - Name `main-protection`, Enforcement **Active**, target **Default branch**.
   - Restrict deletions; Block force pushes; Require linear history: off (merge commits are in use).
   - **Require a pull request:** 1 approval, dismiss stale approvals, require approval of the most recent push, require conversation resolution.
   - **Require status checks** (strict / up-to-date): `gitleaks`, `build`, `Analyze (javascript-typescript)`. `deploy` is excluded because it runs after merge.
   - **Bypass list:** Repository admin, set to *"For pull requests only"*, for emergencies. Each bypass is logged.
3. After confirming the ruleset works, delete the classic rule at Settings → Branches.

## Workflow impact
- Agents can no longer merge with `--admin` silently. Every merge needs the owner's approval click in GitHub (or a logged emergency bypass).
- PRs wait for build and CodeQL (about 3–6 minutes) before merge.
- Hotfixes: the owner can bypass, and it shows in the ruleset insights.
- Without step 1, step 2 forces bypass on every PR. Do step 1 first.
