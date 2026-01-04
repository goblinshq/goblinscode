#!/usr/bin/env bun

/**
 * Sync goblins branch with upstream dev
 *
 * Usage: bun script/sync-goblins.ts
 *
 * This script:
 * 1. Fetches latest upstream dev
 * 2. Rebases goblins commits on top
 * 3. Force pushes to fork
 *
 * If conflicts occur, resolve them manually then run:
 *   git rebase --continue
 *   git push fork goblins --force
 */

import { $ } from "bun"

const UPSTREAM_REMOTE = "origin"
const UPSTREAM_BRANCH = "dev"
const FORK_REMOTE = "fork"
const FORK_BRANCH = "goblins"

async function main() {
  // Ensure we're on goblins branch
  const currentBranch = (await $`git branch --show-current`.text()).trim()
  if (currentBranch !== FORK_BRANCH) {
    console.log(`Switching to ${FORK_BRANCH}...`)
    await $`git checkout ${FORK_BRANCH}`
  }

  // Check for uncommitted changes
  const status = await $`git status --porcelain`.text()
  if (status.trim()) {
    console.error("Error: You have uncommitted changes. Commit or stash them first.")
    process.exit(1)
  }

  // Fetch upstream
  console.log(`Fetching ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}...`)
  await $`git fetch ${UPSTREAM_REMOTE} ${UPSTREAM_BRANCH}`

  // Show what commits are unique to goblins
  console.log("\nGoblins-specific commits:")
  await $`git log --oneline ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}..${FORK_BRANCH}`

  // Count commits ahead/behind
  const behind = (await $`git rev-list --count ${FORK_BRANCH}..${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`.text()).trim()
  const ahead = (await $`git rev-list --count ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}..${FORK_BRANCH}`.text()).trim()

  console.log(
    `\n${FORK_BRANCH} is ${ahead} commits ahead, ${behind} commits behind ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`,
  )

  if (behind === "0") {
    console.log("Already up to date!")
    return
  }

  // Rebase
  console.log(`\nRebasing ${FORK_BRANCH} onto ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}...`)
  const result = await $`git rebase ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`.nothrow()

  if (result.exitCode !== 0) {
    console.error("\nRebase conflicts detected!")
    console.error("Resolve conflicts, then run:")
    console.error("  git rebase --continue")
    console.error(`  git push ${FORK_REMOTE} ${FORK_BRANCH} --force`)
    process.exit(1)
  }

  // Force push to fork
  console.log(`\nPushing to ${FORK_REMOTE}/${FORK_BRANCH}...`)
  await $`git push ${FORK_REMOTE} ${FORK_BRANCH} --force`

  console.log("\nSync complete!")
}

main().catch(console.error)
