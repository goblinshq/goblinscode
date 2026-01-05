import { createMemo, createSignal, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { useTheme } from "../../context/theme"
import { useSync } from "../../context/sync"
import { useDirectory } from "../../context/directory"
import { useConnected } from "../../component/dialog-model"
import { createStore } from "solid-js/store"
import { useRoute } from "../../context/route"
import { useLocal } from "../../context/local"
import { useKV } from "../../context/kv"
import { createColors, createFrames } from "../../ui/spinner"
import "opentui-spinner/solid"

export function Footer(props: { interrupt?: number }) {
  const { theme } = useTheme()
  const sync = useSync()
  const route = useRoute()
  const local = useLocal()
  const kv = useKV()
  const mcp = createMemo(() => Object.values(sync.data.mcp).filter((x) => x.status === "connected").length)
  const mcpError = createMemo(() => Object.values(sync.data.mcp).some((x) => x.status === "failed"))
  const lsp = createMemo(() => Object.keys(sync.data.lsp))
  const permissions = createMemo(() => {
    if (route.data.type !== "session") return []
    return sync.data.permission[route.data.sessionID] ?? []
  })
  const directory = useDirectory()
  const connected = useConnected()

  const sessionID = createMemo(() => (route.data.type === "session" ? route.data.sessionID : ""))
  const status = createMemo(() => sync.data.session_status?.[sessionID()] ?? { type: "idle" })
  const isRunning = createMemo(() => status().type !== "idle")

  const spinnerDef = createMemo(() => {
    const color = local.agent.color(local.agent.current().name)
    return {
      frames: createFrames({ color, style: "blocks", inactiveFactor: 0.6, minAlpha: 0.3 }),
      color: createColors({ color, style: "blocks", inactiveFactor: 0.6, minAlpha: 0.3 }),
    }
  })

  const [store, setStore] = createStore({
    welcome: false,
  })

  onMount(() => {
    function tick() {
      if (connected()) return
      if (!store.welcome) {
        setStore("welcome", true)
        timeout = setTimeout(() => tick(), 5000)
        return
      }

      if (store.welcome) {
        setStore("welcome", false)
        timeout = setTimeout(() => tick(), 10_000)
        return
      }
    }
    let timeout = setTimeout(() => tick(), 10_000)

    onCleanup(() => {
      clearTimeout(timeout)
    })
  })

  const retry = createMemo(() => {
    const s = status()
    if (s.type !== "retry") return
    return s
  })

  const retryMessage = createMemo(() => {
    const r = retry()
    if (!r) return
    if (r.message.includes("exceeded your current quota") && r.message.includes("gemini"))
      return "gemini is way too hot right now"
    if (r.message.length > 50) return r.message.slice(0, 50) + "..."
    return r.message
  })

  const [seconds, setSeconds] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => {
      const next = retry()?.next
      if (next) setSeconds(Math.round((next - Date.now()) / 1000))
    }, 1000)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} flexShrink={0}>
      <Switch>
        <Match when={isRunning()}>
          <box flexDirection="row" gap={1}>
            <Show when={kv.get("animations_enabled", true)} fallback={<text fg={theme.textMuted}>[⋯]</text>}>
              <spinner color={spinnerDef().color} frames={spinnerDef().frames} interval={40} />
            </Show>
            <text fg={(props.interrupt ?? 0) > 0 ? theme.primary : theme.text}>
              esc{" "}
              <span style={{ fg: (props.interrupt ?? 0) > 0 ? theme.primary : theme.textMuted }}>
                {(props.interrupt ?? 0) > 0 ? "again to interrupt" : "interrupt"}
              </span>
            </text>
            <Show when={retry()}>
              <text fg={theme.error}>
                {retryMessage()} [retry #{retry()!.attempt}
                {seconds() > 0 ? ` in ${seconds()}s` : ""}]
              </text>
            </Show>
          </box>
        </Match>
        <Match when={true}>
          <text fg={theme.textMuted}>{directory()}</text>
        </Match>
      </Switch>
      <box gap={2} flexDirection="row" flexShrink={0}>
        <Switch>
          <Match when={store.welcome}>
            <text fg={theme.text}>
              Get started <span style={{ fg: theme.textMuted }}>/connect</span>
            </text>
          </Match>
          <Match when={connected()}>
            <Show when={permissions().length > 0}>
              <text fg={theme.warning}>
                <span style={{ fg: theme.warning }}>△</span> {permissions().length} Permission
                {permissions().length > 1 ? "s" : ""}
              </text>
            </Show>
            <text fg={theme.text}>
              <span style={{ fg: lsp().length > 0 ? theme.success : theme.textMuted }}>•</span> {lsp().length} LSP
            </text>
            <Show when={mcp()}>
              <text fg={theme.text}>
                <Switch>
                  <Match when={mcpError()}>
                    <span style={{ fg: theme.error }}>⊙ </span>
                  </Match>
                  <Match when={true}>
                    <span style={{ fg: theme.success }}>⊙ </span>
                  </Match>
                </Switch>
                {mcp()} MCP
              </text>
            </Show>
            <text fg={theme.textMuted}>/status</text>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
