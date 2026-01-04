import { TextAttributes } from "@opentui/core"
import { For } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { Installation } from "@/installation"

const LOGO_LEFT = [`                   `, `█▀▀█ █▀▀█ █▀▀█ █▀▀▄`, `█░░█ █░░█ █▀▀▀ █░░█`, `▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀`]

const LOGO_RIGHT = [`             ▄     `, `█▀▀▀ █▀▀█ █▀▀█ █▀▀█`, `█░░░ █░░█ █░░█ █▀▀▀`, `▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀`]

const LOGO_GOBLINS = [
  `                              `,
  `█▀▀▀ █▀▀█ █▀▀▄ █░░ ░▀░ █▀▀▄ █▀▀`,
  `█░▀█ █░░█ █▀▀█ █░░ ▀█▀ █░░█ ▀▀█`,
  `▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀ ▀▀▀ ▀  ▀ ▀▀▀`,
]

export function Logo() {
  const { theme } = useTheme()
  const isGoblins = Installation.CHANNEL === "goblins"

  if (isGoblins) {
    return (
      <box>
        <For each={LOGO_GOBLINS}>
          {(line) => (
            <box flexDirection="row">
              <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
                {line}
              </text>
            </box>
          )}
        </For>
      </box>
    )
  }

  return (
    <box>
      <For each={LOGO_LEFT}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <text fg={theme.textMuted} selectable={false}>
              {line}
            </text>
            <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
              {LOGO_RIGHT[index()]}
            </text>
          </box>
        )}
      </For>
    </box>
  )
}
