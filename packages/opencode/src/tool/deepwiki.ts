import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./deepwiki.txt"

const API_CONFIG = {
  BASE_URL: "https://mcp.deepwiki.com",
  ENDPOINTS: {
    MCP: "/mcp",
  },
} as const

interface McpRequest {
  jsonrpc: string
  id: number
  method: string
  params: Record<string, unknown>
}

interface McpResponse {
  jsonrpc: string
  id?: number
  result?: {
    content?: Array<{
      type: string
      text: string
    }>
  }
  error?: {
    code: number
    message: string
  }
}

async function initSession(signal: AbortSignal): Promise<string> {
  const request: McpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "opencode", version: "1.0" },
    },
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MCP}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  })

  if (!response.ok) {
    throw new Error(`DeepWiki init error (${response.status})`)
  }

  const sessionId = response.headers.get("mcp-session-id")
  if (!sessionId) {
    throw new Error("DeepWiki did not return session ID")
  }

  return sessionId
}

function parseSSEResponse(text: string): McpResponse | undefined {
  const lines = text.split("\n")
  for (const line of lines) {
    if (line.startsWith("data: ") && !line.includes("ping")) {
      try {
        return JSON.parse(line.substring(6))
      } catch {
        continue
      }
    }
  }
  return undefined
}

export const DeepWikiTool = Tool.define("deepwiki", {
  description: DESCRIPTION,
  parameters: z.object({
    repo: z
      .string()
      .describe("The GitHub repository in 'owner/repo' format (e.g., 'facebook/react', 'vercel/next.js')"),
    question: z
      .string()
      .describe(
        "The question to ask about the repository. Be specific for better answers (e.g., 'How does the routing system work?', 'What is the architecture of this project?')",
      ),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "deepwiki",
      patterns: [params.repo],
      always: ["*"],
      metadata: {
        repo: params.repo,
        question: params.question,
      },
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    try {
      // Initialize session first
      const sessionId = await initSession(AbortSignal.any([controller.signal, ctx.abort]))

      // Make the tool call
      const request: McpRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "ask_question",
          arguments: {
            repoName: params.repo,
            question: params.question,
          },
        },
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MCP}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.any([controller.signal, ctx.abort]),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`DeepWiki error (${response.status}): ${errorText}`)
      }

      const responseText = await response.text()
      const data = parseSSEResponse(responseText)

      if (data?.error) {
        throw new Error(`DeepWiki error: ${data.error.message}`)
      }

      if (data?.result?.content?.length) {
        return {
          output: data.result.content[0].text,
          title: `DeepWiki: ${params.repo}`,
          metadata: {},
        }
      }

      return {
        output: `No documentation found for ${params.repo}. The repository may not be indexed yet or may be private.`,
        title: `DeepWiki: ${params.repo}`,
        metadata: {},
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("DeepWiki request timed out")
      }

      throw error
    }
  },
})
