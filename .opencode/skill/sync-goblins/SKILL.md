---
name: sync-goblins
description: use this when asked to sync goblins with upstream, update the fork, or pull latest changes from sst/opencode
---

# Sync Goblins Fork with Upstream

This skill syncs the `main` branch with the latest upstream `dev` branch from `sst/opencode`.

## Overview

The goblins fork (`goblinshq/goblinscode`) is our internal fork of opencode with custom patches:

- Custom "GOBLINS" logo in the TUI
- Auto-update from our fork's releases
- Install script at `https://raw.githubusercontent.com/goblinshq/goblinscode/main/install`
- Pre-built binaries via GitHub Actions

## Sync Process

### 1. Ensure you're on the main branch and fetch upstream

```bash
cd /Users/alp/opencode
git checkout main
git fetch origin dev
```

### 2. Check how far behind we are

```bash
git log --oneline main..origin/dev | head -20
```

### 3. Show our goblins-specific commits (these will be rebased)

```bash
git log --oneline origin/dev..main
```

### 4. Merge upstream dev into main

```bash
git merge origin/dev -m "Merge upstream sst/opencode dev branch"
```

### 5. Handle Conflicts

If conflicts occur, they're typically in these files:

**`packages/opencode/src/installation/index.ts`** - The update/upgrade logic

- Always use our goblinshq/goblinscode URLs:
  - Upgrade URL: `https://raw.githubusercontent.com/goblinshq/goblinscode/main/install`
  - Latest check URL: `https://api.github.com/repos/goblinshq/goblinscode/releases/tags/goblins-latest`
- Remove any branching logic (no `CHANNEL === "goblins"` checks - we ARE goblins)

**`install`** - The install script

- Keep our simple gcode installer (downloads from goblinshq/goblinscode releases)
- Don't merge in the upstream install script complexity

**`packages/opencode/src/cli/cmd/tui/component/logo.tsx`** - The TUI logo

- Keep the GOBLINS logo, not the opencode logo

**`packages/script/src/index.ts`** - Version generation

- Keep date+hash format: `goblins-YYYY-MM-DD-<short-hash>`

To resolve conflicts:

```bash
# Edit the conflicted file to keep our goblins-specific code
# Then:
git add <file>
git commit
```

### 6. Push to fork

```bash
git push fork main
```

### 7. Wait for GitHub Actions build

```bash
gh run list --repo goblinshq/goblinscode --workflow goblins --limit 1 --json databaseId --jq '.[0].databaseId'
# Then watch:
gh run watch <run-id> --repo goblinshq/goblinscode --exit-status
```

### 8. Test the install

```bash
curl -fsSL https://raw.githubusercontent.com/goblinshq/goblinscode/main/install | bash
gcode --version
```

## Key Files in Goblins Fork

| File                                                   | Purpose                                                  |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `install`                                              | Curl installer for gcode binary                          |
| `.github/workflows/goblins.yml`                        | Builds binaries for darwin-arm64, linux-x64, linux-arm64 |
| `packages/opencode/src/cli/cmd/tui/component/logo.tsx` | GOBLINS logo                                             |
| `packages/opencode/src/installation/index.ts`          | Update/upgrade to use our fork                           |
| `packages/script/src/index.ts`                         | Version format (goblins-date-hash)                       |

## Common Issues

1. **Paid runner error for darwin-x64**: We removed this target - only free runners
2. **Version comparison for auto-update**: Uses string comparison of `goblins-YYYY-MM-DD-hash`
3. **Binary signing**: Signed at build time in GitHub Actions, no need to re-sign on install
