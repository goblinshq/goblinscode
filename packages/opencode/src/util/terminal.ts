/**
 * Simple ANSI terminal emulator that processes escape sequences
 * to produce the final rendered output as it would appear on screen.
 *
 * Handles:
 * - \r (carriage return)
 * - \n (newline)
 * - \x1b[nA (cursor up)
 * - \x1b[nB (cursor down)
 * - \x1b[nC (cursor forward)
 * - \x1b[nD (cursor backward)
 * - \x1b[H, \x1b[;H, \x1b[n;mH (cursor position)
 * - \x1b[K, \x1b[0K (clear to end of line)
 * - \x1b[1K (clear to start of line)
 * - \x1b[2K (clear entire line)
 * - \x1b[J, \x1b[0J (clear to end of screen)
 * - \x1b[1J (clear to start of screen)
 * - \x1b[2J (clear entire screen)
 * - \x1b[...m (SGR - colors/styles, stripped)
 */

export function renderTerminal(input: string): string {
  const lines: string[] = [""]
  let row = 0
  let col = 0

  const ensureRow = (r: number) => {
    while (lines.length <= r) lines.push("")
  }

  const ensureCol = (line: string, c: number): string => {
    if (line.length < c) return line + " ".repeat(c - line.length)
    return line
  }

  const writeChar = (char: string) => {
    ensureRow(row)
    lines[row] = ensureCol(lines[row], col)
    lines[row] = lines[row].slice(0, col) + char + lines[row].slice(col + 1)
    col++
  }

  let i = 0
  while (i < input.length) {
    const char = input[i]

    // Handle OSC sequences (Operating System Command) - \x1b] ... \x07 or \x1b]...\x1b\\
    if (char === "\x1b" && input[i + 1] === "]") {
      i += 2
      // Skip until we find BEL (\x07) or ST (\x1b\\)
      while (i < input.length) {
        if (input[i] === "\x07") {
          i++
          break
        }
        if (input[i] === "\x1b" && input[i + 1] === "\\") {
          i += 2
          break
        }
        i++
      }
      continue
    }

    // Handle escape sequences
    if (char === "\x1b" && input[i + 1] === "[") {
      const escStart = i
      i += 2
      let params = ""
      while (i < input.length && /[0-9;]/.test(input[i])) {
        params += input[i]
        i++
      }
      const cmd = input[i]
      i++

      // Parse params - empty string means use default (handled per-command)
      const nums = params === "" ? [] : params.split(";").map((n) => (n === "" ? undefined : parseInt(n, 10)))

      switch (cmd) {
        case "A": // Cursor up
          row = Math.max(0, row - (nums[0] ?? 1))
          break
        case "B": // Cursor down
          row += nums[0] ?? 1
          ensureRow(row)
          break
        case "C": // Cursor forward
          col += nums[0] ?? 1
          break
        case "D": // Cursor backward
          col = Math.max(0, col - (nums[0] ?? 1))
          break
        case "H": // Cursor position
        case "f": // Same as H
          row = Math.max(0, (nums[0] ?? 1) - 1)
          col = Math.max(0, (nums[1] ?? 1) - 1)
          ensureRow(row)
          break
        case "J": // Clear screen
          ensureRow(row)
          switch (nums[0] ?? 0) {
            case 0: // Clear from cursor to end
              lines[row] = lines[row].slice(0, col)
              lines.length = row + 1
              break
            case 1: // Clear from start to cursor
              lines[row] = " ".repeat(col) + lines[row].slice(col)
              for (let r = 0; r < row; r++) lines[r] = ""
              break
            case 2: // Clear entire screen
            case 3: // Clear entire screen + scrollback
              lines.length = 0
              lines.push("")
              row = 0
              col = 0
              break
          }
          break
        case "K": // Clear line
          ensureRow(row)
          switch (nums[0] ?? 0) {
            case 0: // Clear from cursor to end
              lines[row] = lines[row].slice(0, col)
              break
            case 1: // Clear from start to cursor
              lines[row] = " ".repeat(col) + lines[row].slice(col)
              break
            case 2: // Clear entire line
              lines[row] = ""
              break
          }
          break
        case "m": // SGR (colors/styles) - ignore
          break
        default:
          // Unknown escape sequence, skip
          break
      }
      continue
    }

    // Skip any other escape sequences we don't recognize
    if (char === "\x1b") {
      i++
      // Skip the next character (single-char escape)
      if (i < input.length) i++
      continue
    }

    // Handle regular characters
    switch (char) {
      case "\r":
        col = 0
        break
      case "\n":
        row++
        col = 0
        ensureRow(row)
        break
      case "\t": {
        // Tab to next 8-column stop
        const tabStop = Math.floor(col / 8) * 8 + 8
        while (col < tabStop) writeChar(" ")
        break
      }
      case "\b":
        col = Math.max(0, col - 1)
        break
      default:
        if (char.charCodeAt(0) >= 32) {
          writeChar(char)
        }
        break
    }
    i++
  }

  // Trim trailing empty lines and trailing spaces
  while (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  return lines.map((l) => l.trimEnd()).join("\n")
}
