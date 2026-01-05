import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./websearch.txt"
import { Auth } from "../auth"

const API_CONFIG = {
  BASE_URL: "https://search-mcp.parallel.ai",
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
    isError?: boolean
  }
  error?: {
    code: number
    message: string
  }
}

async function getApiKey(): Promise<string> {
  const auth = await Auth.get("parallel")
  if (!auth || auth.type !== "api") {
    throw new Error(
      "Parallel API key not configured. To enable web search:\n" +
        "1. Get an API key from https://parallel.ai\n" +
        "2. Press Ctrl+P and select /connect\n" +
        "3. Choose 'Parallel' under Services and enter your API key",
    )
  }
  return auth.key
}

export const WebSearchTool = Tool.define("websearch", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z.string().describe("Search query"),
  }),
  async execute(params, ctx) {
    const apiKey = await getApiKey()

    await ctx.ask({
      permission: "websearch",
      patterns: [params.query],
      always: ["*"],
      metadata: {
        query: params.query,
      },
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const request: McpRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "web_search_preview",
          arguments: {
            objective: params.query,
            search_queries: [params.query],
          },
        },
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MCP}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.any([controller.signal, ctx.abort]),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Parallel search error (${response.status}): ${errorText}`)
      }

      const data: McpResponse = await response.json()

      if (data.error) {
        throw new Error(`Parallel error: ${data.error.message}`)
      }

      if (data.result?.isError) {
        const errorText = data.result.content?.[0]?.text || "Unknown error"
        throw new Error(`Parallel error: ${errorText}`)
      }

      if (data.result?.content?.length) {
        return {
          output: data.result.content[0].text,
          title: `🔍 ${params.query}`,
          metadata: {},
        }
      }

      return {
        output: "No search results found. Please try a different query.",
        title: `🔍 ${params.query}`,
        metadata: {},
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Search request timed out")
      }

      throw error
    }
  },
})
