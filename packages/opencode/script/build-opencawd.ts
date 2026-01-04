#!/usr/bin/env bun

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "../../..")

process.chdir(root)

const dest = path.join(process.env.HOME!, "bin/opencawd")

console.log("Pulling latest dev...")
await $`git pull origin dev`

console.log("Building binary...")
process.chdir(path.join(root, "packages/opencode"))
await $`bun script/build.ts --single`

const binary = "dist/opencode-darwin-arm64/bin/opencode"

console.log("Signing binary...")
await $`codesign -s - ${binary}`

console.log(`Copying to ${dest}...`)
await $`rm -f ${dest}`
await $`cp ${binary} ${dest}`

const version = await $`${dest} --version`.text()
console.log(`Done! Installed opencawd version: ${version.trim()}`)
