import z from "zod"
import { spawn } from "child_process"
import { Tool } from "./tool"
import path from "path"
import DESCRIPTION from "./bash.txt"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { lazy } from "@/util/lazy"
import { Language } from "web-tree-sitter"

import { $ } from "bun"
import { Filesystem } from "@/util/filesystem"
import { fileURLToPath } from "url"
import { Flag } from "@/flag/flag.ts"
import { Shell } from "@/shell/shell"

import { BashArity } from "@/permission/arity"

const getPty = async () => {
  const { spawn } = await import("bun-pty")
  return spawn
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const MAX_OUTPUT_LENGTH = Flag.OPENCODE_EXPERIMENTAL_BASH_MAX_OUTPUT_LENGTH || 30_000
const DEFAULT_TIMEOUT = Flag.OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS || 2 * 60 * 1000

export const log = Log.create({ service: "bash-tool" })

const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

const parser = lazy(async () => {
  const { Parser } = await import("web-tree-sitter")
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  const { default: bashWasm } = await import("tree-sitter-bash/tree-sitter-bash.wasm" as string, {
    with: { type: "wasm" },
  })
  const bashPath = resolveWasm(bashWasm)
  const bashLanguage = await Language.load(bashPath)
  const p = new Parser()
  p.setLanguage(bashLanguage)
  return p
})

// TODO: we may wanna rename this tool so it works better on other shells
export const BashTool = Tool.define("bash", async () => {
  const shell = Shell.acceptable()
  log.info("bash tool using shell", { shell })

  return {
    description: DESCRIPTION.replaceAll("${directory}", Instance.directory),
    parameters: z.object({
      command: z.string().describe("The command to execute"),
      timeout: z.number().describe("Optional timeout in milliseconds").optional(),
      workdir: z
        .string()
        .describe(
          `The working directory to run the command in. Defaults to ${Instance.directory}. Use this instead of 'cd' commands.`,
        )
        .optional(),
    }),
    async execute(params, ctx) {
      const cwd = params.workdir || Instance.directory
      if (params.timeout !== undefined && params.timeout < 0) {
        throw new Error(`Invalid timeout value: ${params.timeout}. Timeout must be a positive number.`)
      }
      const timeout = params.timeout ?? DEFAULT_TIMEOUT
      const tree = await parser().then((p) => p.parse(params.command))
      if (!tree) {
        throw new Error("Failed to parse command")
      }
      const directories = new Set<string>()
      if (!Filesystem.contains(Instance.directory, cwd)) directories.add(cwd)
      const patterns = new Set<string>()
      const always = new Set<string>()

      for (const node of tree.rootNode.descendantsOfType("command")) {
        if (!node) continue
        const command = []
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i)
          if (!child) continue
          if (
            child.type !== "command_name" &&
            child.type !== "word" &&
            child.type !== "string" &&
            child.type !== "raw_string" &&
            child.type !== "concatenation"
          ) {
            continue
          }
          command.push(child.text)
        }

        // not an exhaustive list, but covers most common cases
        if (["cd", "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown"].includes(command[0])) {
          for (const arg of command.slice(1)) {
            if (arg.startsWith("-") || (command[0] === "chmod" && arg.startsWith("+"))) continue
            const resolved = await $`realpath ${arg}`
              .cwd(cwd)
              .quiet()
              .nothrow()
              .text()
              .then((x) => x.trim())
            log.info("resolved path", { arg, resolved })
            if (resolved) {
              // Git Bash on Windows returns Unix-style paths like /c/Users/...
              const normalized =
                process.platform === "win32" && resolved.match(/^\/[a-z]\//)
                  ? resolved.replace(/^\/([a-z])\//, (_, drive) => `${drive.toUpperCase()}:\\`).replace(/\//g, "\\")
                  : resolved
              if (!Filesystem.contains(Instance.directory, normalized)) directories.add(normalized)
            }
          }
        }

        // cd covered by above check
        if (command.length && command[0] !== "cd") {
          patterns.add(command.join(" "))
          always.add(BashArity.prefix(command).join(" ") + "*")
        }
      }

      if (directories.size > 0) {
        await ctx.ask({
          permission: "external_directory",
          patterns: Array.from(directories),
          always: Array.from(directories).map((x) => path.dirname(x) + "*"),
          metadata: {},
        })
      }

      if (patterns.size > 0) {
        await ctx.ask({
          permission: "bash",
          patterns: Array.from(patterns),
          always: Array.from(always),
          metadata: {},
        })
      }

      let output = ""
      let exitCode = 0

      // Initialize metadata with empty output
      ctx.metadata({
        metadata: {
          output: "",
        },
      })

      const append = (chunk: string | Buffer) => {
        if (output.length <= MAX_OUTPUT_LENGTH) {
          output += chunk.toString()
          ctx.metadata({
            metadata: {
              output,
            },
          })
        }
      }

      let timedOut = false
      let aborted = false

      // Try PTY with retries, fall back to regular spawn if all attempts fail
      let usedPty = false
      const PTY_RETRIES = 3
      let proc: any
      let ptyError: unknown

      for (let attempt = 0; attempt < PTY_RETRIES; attempt++) {
        try {
          const ptySpawn = await getPty()
          proc = ptySpawn(shell, ["-c", params.command], {
            name: "xterm-256color",
            cwd,
            env: {
              ...process.env,
              TERM: "xterm-256color",
              CI: "true",
              DEBIAN_FRONTEND: "noninteractive",
              GIT_TERMINAL_PROMPT: "0",
              GH_PROMPT_DISABLED: "1",
              npm_config_yes: "true",
              PAGER: "cat",
              GIT_PAGER: "cat",
            },
          })
          usedPty = true
          break
        } catch (e) {
          ptyError = e
          if (attempt < PTY_RETRIES - 1) {
            log.warn("PTY spawn failed, retrying", { attempt: attempt + 1, error: e })
            await sleep(50 * (attempt + 1))
          }
        }
      }

      if (usedPty && proc) {
        // PTY path
        proc.onData(append)

        const kill = () => {
          try {
            proc.kill()
          } catch {}
        }

        if (ctx.abort.aborted) {
          aborted = true
          kill()
        }

        const abortHandler = () => {
          aborted = true
          kill()
        }

        ctx.abort.addEventListener("abort", abortHandler, { once: true })

        const timeoutTimer = setTimeout(() => {
          timedOut = true
          kill()
        }, timeout + 100)

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            clearTimeout(timeoutTimer)
            ctx.abort.removeEventListener("abort", abortHandler)
          }

          proc.onExit(({ exitCode: code }: { exitCode: number }) => {
            exitCode = code
            cleanup()
            resolve()
          })
        })
      } else {
        // Fallback to regular spawn
        log.warn("PTY spawn failed after retries, falling back to regular spawn", { error: ptyError })

        const fallbackProc = spawn(params.command, {
          shell,
          cwd,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          detached: process.platform !== "win32",
        })

        fallbackProc.stdout?.on("data", append)
        fallbackProc.stderr?.on("data", append)

        let exited = false
        const kill = () => Shell.killTree(fallbackProc, { exited: () => exited })

        if (ctx.abort.aborted) {
          aborted = true
          await kill()
        }

        const abortHandler = () => {
          aborted = true
          void kill()
        }

        ctx.abort.addEventListener("abort", abortHandler, { once: true })

        const timeoutTimer = setTimeout(() => {
          timedOut = true
          void kill()
        }, timeout + 100)

        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timeoutTimer)
            ctx.abort.removeEventListener("abort", abortHandler)
          }

          fallbackProc.once("exit", (code) => {
            exited = true
            exitCode = code ?? 0
            cleanup()
            resolve()
          })

          fallbackProc.once("error", (error) => {
            exited = true
            cleanup()
            reject(error)
          })
        })
      }

      let resultMetadata: String[] = ["<bash_metadata>"]

      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH)
        resultMetadata.push(`bash tool truncated output as it exceeded ${MAX_OUTPUT_LENGTH} char limit`)
      }

      if (timedOut) {
        resultMetadata.push(`bash tool terminated command after exceeding timeout ${timeout} ms`)
      }

      if (aborted) {
        resultMetadata.push("User aborted the command")
      }

      if (resultMetadata.length > 1) {
        resultMetadata.push("</bash_metadata>")
        output += "\n\n" + resultMetadata.join("\n")
      }

      return {
        title: params.command,
        metadata: {
          output,
          exit: exitCode,
        },
        output,
      }
    },
  }
})
