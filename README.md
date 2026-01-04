<p align="center">
  <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="gcode logo" width="200">
</p>
<h1 align="center">it's goblin time</h1>
<p align="center">Goblins fork of <a href="https://github.com/sst/opencode">OpenCode</a> - the open source AI coding agent.</p>

---

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/goblinshq/goblinscode/main/install | bash
```

Then run:

```bash
gcode
```

## What is this?

This is **gcode** - the Goblins team's customized fork of [OpenCode](https://opencode.ai). It includes:

- Custom GOBLINS branding in the TUI
- Auto-updates from our fork's releases
- Pre-built binaries for darwin-arm64, linux-x64, linux-arm64

## Syncing with Upstream

We track upstream `sst/opencode` and periodically merge in new features. To sync:

```bash
# In your local clone
git fetch origin dev
git merge origin/dev -m "Merge upstream sst/opencode dev branch"
git push fork main
```

Or just ask gcode to "sync from upstream" - it will use the built-in skill.

See [.opencode/skill/sync-from-upstream/skill.md](.opencode/skill/sync-from-upstream/skill.md) for detailed instructions on handling merge conflicts.

## Key Differences from Upstream

| File | Change |
|------|--------|
| `install` | Downloads `gcode` binary from our releases |
| `packages/opencode/src/installation/index.ts` | Points to `goblinshq/goblinscode` for updates |
| `packages/opencode/src/cli/cmd/tui/component/logo.tsx` | GOBLINS logo |
| `packages/script/src/index.ts` | Version format: `goblins-YYYY-MM-DD-<hash>` |

## Upstream Docs

For general OpenCode documentation, see [opencode.ai/docs](https://opencode.ai/docs).

---

**Goblins HQ** | [goblinsapp.com](https://goblinsapp.com)
