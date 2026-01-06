import { type Accessor, createMemo, For, Match, Show, Switch } from "solid-js"
import { useRoute, useRouteData } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { pipe, sumBy } from "remeda"
import { useTheme } from "@tui/context/theme"
import { SplitBorder, EmptyBorder } from "@tui/component/border"
import type { AssistantMessage, Session } from "@opencode-ai/sdk/v2"
import { useDirectory } from "../../context/directory"
import { useKeybind } from "../../context/keybind"

const Title = (props: { session: Accessor<Session> }) => {
  const { theme } = useTheme()
  return (
    <text fg={theme.text}>
      <span style={{ bold: true }}>{props.session().title}</span>
    </text>
  )
}

const ContextInfo = (props: { context: Accessor<string | undefined>; cost: Accessor<string> }) => {
  const { theme } = useTheme()
  return (
    <Show when={props.context()}>
      <text fg={theme.textMuted} wrapMode="none" flexShrink={0}>
        {props.context()} ({props.cost()})
      </text>
    </Show>
  )
}

function SubagentBadges(props: { sessionID: string; parentID: string }) {
  const sync = useSync()
  const { theme } = useTheme()
  const { navigate } = useRoute()

  const siblings = createMemo(() => {
    const all = sync.data.session
      .filter((x) => x.parentID === props.parentID)
      .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const offset = Math.max(0, all.length - 10)
    return all.slice(-10).map((s, i) => ({ ...s, index: offset + i + 1 }))
  })

  const isWorking = (sessionID: string) => {
    const msgs = sync.data.message[sessionID] ?? []
    const last = msgs.findLast((x) => x.role === "assistant")
    if (!last) return true
    return !last.time.completed
  }

  return (
    <box flexDirection="row" gap={1}>
      <For each={siblings()}>
        {(session) => {
          const active = createMemo(() => session.id === props.sessionID)
          const working = createMemo(() => isWorking(session.id))
          return (
            <box border={["bottom"]} borderColor={working() ? theme.warning : theme.textMuted}>
              <text
                bg={active() ? theme.accent : theme.backgroundElement}
                fg={active() ? theme.background : theme.text}
                onMouseDown={() => navigate({ type: "session", sessionID: session.id })}
              >
                {" "}
                {session.index}{" "}
              </text>
            </box>
          )
        }}
      </For>
    </box>
  )
}

export function Header() {
  const route = useRouteData("session")
  const sync = useSync()
  const session = createMemo(() => sync.session.get(route.sessionID)!)
  const messages = createMemo(() => sync.data.message[route.sessionID] ?? [])

  const cost = createMemo(() => {
    const total = pipe(
      messages(),
      sumBy((x) => (x.role === "assistant" ? x.cost : 0)),
    )
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total)
  })

  const context = createMemo(() => {
    const last = messages().findLast((x) => x.role === "assistant" && x.tokens.output > 0) as AssistantMessage
    if (!last) return
    const total =
      last.tokens.input + last.tokens.output + last.tokens.reasoning + last.tokens.cache.read + last.tokens.cache.write
    const model = sync.data.provider.find((x) => x.id === last.providerID)?.models[last.modelID]
    let result = total.toLocaleString()
    if (model?.limit.context) {
      result += "  " + Math.round((total / model.limit.context) * 100) + "%"
    }
    return result
  })

  const { theme } = useTheme()
  const keybind = useKeybind()

  return (
    <box flexShrink={0}>
      <box
        paddingLeft={2}
        paddingRight={1}
        {...SplitBorder}
        border={["left"]}
        borderColor={theme.border}
        flexShrink={0}
      >
        <Switch>
          <Match when={session()?.parentID}>
            <box flexDirection="row" gap={1} alignItems="center">
              <text fg={theme.textMuted}>Subagents</text>
              <SubagentBadges sessionID={route.sessionID} parentID={session()!.parentID!} />
              <box width={1} />
              <text fg={theme.textMuted}>{keybind.print("session_parent")} parent</text>
              <box flexGrow={1} flexShrink={1} />
              <ContextInfo context={context} cost={cost} />
            </box>
          </Match>
          <Match when={true}>
            <box flexDirection="row" justifyContent="space-between" gap={1}>
              <Title session={session} />
              <ContextInfo context={context} cost={cost} />
            </box>
          </Match>
        </Switch>
      </box>
    </box>
  )
}
