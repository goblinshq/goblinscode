#!/usr/bin/env bun

import { $ } from "bun"
import { createOpencode } from "@opencode-ai/sdk"
import { parseArgs } from "util"

export const team = [
  "actions-user",
  "opencode",
  "rekram1-node",
  "thdxr",
  "kommander",
  "jayair",
  "fwang",
  "adamdotdevin",
  "iamdavidhill",
  "opencode-agent[bot]",
]

export async function getLatestRelease() {
  return fetch("https://api.github.com/repos/sst/opencode/releases/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.tag_name.replace(/^v/, ""))
}

export async function getCommits(from: string, to: string) {
  const fromRef = from.startsWith("v") ? from : `v${from}`
  const toRef = to === "HEAD" ? to : to.startsWith("v") ? to : `v${to}`
  const log =
    await $`git log ${fromRef}..${toRef} --oneline --format="%h %s" -- packages/opencode packages/sdk packages/plugin packages/desktop packages/app`.text()
  return log.split("\n").filter((line) => line && !line.match(/^\w+ (ignore:|test:|chore:|ci:)/i))
}

export async function generateChangelog(from: string, to: string, commits: string[]) {
  const opencode = await createOpencode()
  const session = await opencode.client.session.create()
  console.log("generating changelog since " + from)

  const raw = await opencode.client.session
    .prompt({
      path: {
        id: session.data!.id,
      },
      body: {
        model: {
          providerID: "opencode",
          modelID: "claude-sonnet-4-5",
        },
        parts: [
          {
            type: "text",
            text: `
            Analyze these commits and generate a changelog of all notable user facing changes, grouped by area.

            Each commit below includes:
            - [author: username] showing the GitHub username of the commit author
            - [areas: ...] showing which areas of the codebase were modified

            Commits between ${from} and ${to}:
            ${commits.join("\n")}

            Group the changes into these categories based on the [areas: ...] tags (omit any category with no changes):
            - **TUI**: Changes to "opencode" area (the terminal/CLI interface)
            - **Desktop**: Changes to "app" or "tauri" areas (the desktop application)
            - **SDK**: Changes to "sdk" or "plugin" areas (the SDK and plugin system)
            - **Extensions**: Changes to "extensions/zed", "extensions/vscode", or "github" areas (editor extensions and GitHub Action)
            - **Other**: Any user-facing changes that don't fit the above categories

            Excluded areas (omit these entirely unless they contain user-facing changes like refactors that may affect behavior):
            - "nix", "infra", "script" - CI/build infrastructure
            - "ui", "docs", "web", "console", "enterprise", "function", "util", "identity", "slack" - internal packages

            Rules:
            - Use the [areas: ...] tags to determine the correct category. If a commit touches multiple areas, put it in the most relevant user-facing category.
            - ONLY include commits that have user-facing impact. Omit purely internal changes (CI, build scripts, internal tooling).
            - However, DO include refactors that touch user-facing code - refactors can introduce bugs or change behavior.
            - Do NOT make general statements about "improvements", be very specific about what was changed.
            - For commits that are already well-written and descriptive, avoid rewording them. Simply capitalize the first letter, fix any misspellings, and ensure proper English grammar.
            - DO NOT read any other commits than the ones listed above (THIS IS IMPORTANT TO AVOID DUPLICATING THINGS IN OUR CHANGELOG).
            - If a commit was made and then reverted do not include it in the changelog. If the commits only include a revert but not the original commit, then include the revert in the changelog.
            - Omit categories that have no changes.
            - For community contributors: if the [author: username] is NOT in the team list, add (@username) at the end of the changelog entry. This is REQUIRED for all non-team contributors.
            - The team members are: ${team.join(", ")}. Do NOT add @ mentions for team members.

            IMPORTANT: ONLY return the grouped changelog, do not include any other information. Do not include a preamble like "Based on my analysis..." or "Here is the changelog..."

            <example>
            ## TUI
            - Added experimental support for the Ty language server (@OpeOginni)
            - Added /fork slash command for keyboard-friendly session forking (@ariane-emory)
            - Increased retry attempts for failed requests
            - Fixed model validation before executing slash commands (@devxoul)

            ## Desktop
            - Added shell mode support
            - Fixed prompt history navigation and optimistic prompt duplication
            - Disabled pinch-to-zoom on Linux (@Brendonovich)

            ## Extensions
            - Added OIDC_BASE_URL support for custom GitHub App installations (@elithrar)
            </example>
          `,
          },
        ],
      },
    })
    .then((x) => x.data?.parts?.find((y) => y.type === "text")?.text)
  opencode.server.close()
  return raw
}

export async function getContributors(from: string, to: string) {
  const fromRef = from.startsWith("v") ? from : `v${from}`
  const toRef = to === "HEAD" ? to : to.startsWith("v") ? to : `v${to}`
  const compare =
    await $`gh api "/repos/sst/opencode/compare/${fromRef}...${toRef}" --jq '.commits[] | {login: .author.login, message: .commit.message}'`.text()
  const contributors = new Map<string, string[]>()

  for (const line of compare.split("\n").filter(Boolean)) {
    const { login, message } = JSON.parse(line) as { login: string | null; message: string }
    const title = message.split("\n")[0] ?? ""
    if (title.match(/^(ignore:|test:|chore:|ci:|release:)/i)) continue

    if (login && !team.includes(login)) {
      if (!contributors.has(login)) contributors.set(login, [])
      contributors.get(login)?.push(title)
    }
  }

  return contributors
}

export async function buildNotes(from: string, to: string) {
  const notes: string[] = []
  const commits = await getCommits(from, to)

  if (commits.length === 0) {
    return notes
  }

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 120_000))
  const raw = await Promise.race([generateChangelog(from, to, commits), timeout])

  if (raw) {
    for (const line of raw.split("\n")) {
      if (line.startsWith("- ")) {
        notes.push(line)
      }
    }
    console.log("---- Generated Changelog ----")
    console.log(notes.join("\n"))
    console.log("-----------------------------")
  } else {
    console.log("Changelog generation timed out, using raw commits")
    for (const commit of commits) {
      const message = commit.replace(/^\w+ /, "")
      notes.push(`- ${message}`)
    }
  }

  const contributors = await getContributors(from, to)

  if (contributors.size > 0) {
    notes.push("")
    notes.push(`**Thank you to ${contributors.size} community contributor${contributors.size > 1 ? "s" : ""}:**`)
    for (const [username, userCommits] of contributors) {
      notes.push(`- @${username}:`)
      for (const commit of userCommits) {
        notes.push(`  - ${commit}`)
      }
    }
  }

  return notes
}

// CLI entrypoint
if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      from: { type: "string", short: "f" },
      to: { type: "string", short: "t", default: "HEAD" },
      help: { type: "boolean", short: "h", default: false },
    },
  })

  if (values.help) {
    console.log(`
Usage: bun script/changelog.ts [options]

Options:
  -f, --from <version>   Starting version (default: latest GitHub release)
  -t, --to <ref>         Ending ref (default: HEAD)
  -h, --help             Show this help message

Examples:
  bun script/changelog.ts                     # Latest release to HEAD
  bun script/changelog.ts --from 1.0.200      # v1.0.200 to HEAD
  bun script/changelog.ts -f 1.0.200 -t 1.0.205
`)
    process.exit(0)
  }

  const to = values.to!
  const from = values.from ?? (await getLatestRelease())

  console.log(`Generating changelog: v${from} -> ${to}\n`)

  const notes = await buildNotes(from, to)
  console.log("\n=== Final Notes ===")
  console.log(notes.join("\n"))
}
