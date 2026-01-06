---
name: sync-from-upstream
description: use this when asked to sync from upstream, update the fork, or pull latest changes from sst/opencode
---

# Sync Goblins Fork with Upstream

This skill syncs the `main` branch with the latest upstream `dev` branch from `sst/opencode`.

## Critical Principle

**Keep our styles and business logic, pull in bug fixes and new features.**

We have extensive customizations to the TUI, tool rendering, system prompts, and more. When merging:

- ALWAYS keep our version of UI/style files
- ALWAYS keep our custom tool rendering components
- ALWAYS keep our system prompts and agent configurations
- Cherry-pick or carefully merge only bug fixes and new features that don't conflict with our customizations

## Overview

The goblins fork (`goblinshq/goblinscode`) is our internal fork of opencode with custom patches:

- Custom "GOBLINS" logo in the TUI
- Custom tool rendering (badges, shimmer effects, inline tools)
- Custom system prompts (goblins.txt, communication style)
- PTY-based bash execution for better TTY compatibility
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
git log --oneline main..origin/dev | head -30
```

### 3. Review what upstream changed

Before merging, understand what upstream modified:

```bash
git diff main..origin/dev --stat | tail -30
```

Pay special attention to changes in:

- `packages/opencode/src/cli/cmd/tui/` - TUI components (likely conflicts)
- `packages/opencode/src/tool/` - Tool implementations (we have custom bash.ts)
- `packages/opencode/src/session/` - Session/prompt logic

### 4. Merge Strategy

**DO NOT blindly merge.** Instead:

```bash
git merge origin/dev -m "Merge upstream sst/opencode dev branch"
```

If conflicts occur, **default to keeping our version** for:

- Any file in `routes/session/` (our custom tool rendering)
- `bash.ts` (our PTY implementation)
- Any prompt/agent files
- `logo.tsx`, `install`, `installation/index.ts`

### 5. Conflict Resolution Guide

#### Files to ALWAYS keep ours (`git checkout --ours <file>`):

| File                                                         | Reason                                         |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `install`                                                    | Our simple gcode installer                     |
| `README.md`                                                  | Our goblins README                             |
| `packages/opencode/src/cli/cmd/tui/routes/session/index.tsx` | Custom tool rendering, badges, shimmer effects |
| `packages/opencode/src/cli/cmd/tui/component/logo.tsx`       | GOBLINS logo                                   |
| `packages/opencode/src/tool/bash.ts`                         | PTY-based execution                            |
| `packages/opencode/src/installation/index.ts`                | Our update URLs                                |
| `packages/opencode/src/session/prompt/goblins.ts`            | Our system prompt                              |
| `packages/script/src/index.ts`                               | Version format                                 |

#### Files to carefully review and merge:

| File                                      | Strategy                                |
| ----------------------------------------- | --------------------------------------- |
| `packages/opencode/src/session/prompt.ts` | Take bug fixes, keep our customizations |
| `packages/opencode/src/provider/`         | Usually safe to take upstream           |
| `packages/opencode/src/lsp/`              | Usually safe to take upstream           |
| `packages/opencode/test/`                 | Usually safe to take upstream           |

#### Files safe to take from upstream (`git checkout --theirs <file>`):

- Documentation files (except README.md)
- GitHub workflow files (except our `release.yml`)
- Package version bumps
- New features in areas we haven't customized

### 6. Post-Merge Verification

```bash
# Typecheck
bun run --filter opencode typecheck

# Quick visual test
cd packages/opencode && bun dev
```

Verify:

- [ ] GOBLINS logo appears
- [ ] Tool badges render correctly (not plain text)
- [ ] Shimmer animations work
- [ ] Bash commands use PTY (check with `tty` command)

### 7. If merge goes wrong

Abort and reset:

```bash
git merge --abort
# or if already committed:
git reset --hard HEAD~1
```

### 8. Push to fork

Only after verification passes:

```bash
git push fork main
```

### 9. Wait for GitHub Actions build

```bash
gh run list --repo goblinshq/goblinscode --workflow release --limit 1
gh run watch <run-id> --repo goblinshq/goblinscode --exit-status
```

## Key Customizations We Maintain

### TUI Tool Rendering (`routes/session/index.tsx`)

- `InlineTool` component with icon badges
- `BlockTool` component for expanded output
- `ShimmerBadge` for loading animations
- Custom tool-specific components (Bash, Edit, Write, Task, etc.)
- Tool badge mappings (`TOOL_BADGE`)

### Bash Tool (`tool/bash.ts`)

- PTY-based execution via `bun-pty`
- Real-time streaming output
- Environment variables to suppress interactive prompts
- OSC escape sequence stripping

### System Prompt (`session/prompt/goblins.ts`)

- Communication style (Minto pyramid, funky professor tone)
- Tool usage guidance
- Git safety protocols
- Parallelization strategies

### Task/Subagent UI

- Whimsical naming convention
- Agent type badges with colors
- Tool summary in preview box
- Clickable navigation to subagent sessions

## Common Issues

1. **Upstream adds new tool parameters**: Check if our tool rendering handles them gracefully (use `(props.input as any).newParam` pattern if needed)
2. **Upstream changes tool types**: May break our `ToolProps<typeof XTool>` - need to update type imports
3. **Upstream modifies prompt structure**: Keep our prompts, cherry-pick only bug fixes
4. **Build fails after merge**: Usually type errors - check the conflicting areas first
