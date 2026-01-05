import { describe, expect, test } from "bun:test"
import { renderTerminal } from "../../src/util/terminal"

describe("renderTerminal", () => {
  describe("basic text", () => {
    test("passes through plain text", () => {
      expect(renderTerminal("hello world")).toBe("hello world")
    })

    test("handles multiple lines", () => {
      expect(renderTerminal("line1\nline2\nline3")).toBe("line1\nline2\nline3")
    })

    test("trims trailing empty lines", () => {
      expect(renderTerminal("hello\n\n\n")).toBe("hello")
    })

    test("trims trailing spaces", () => {
      expect(renderTerminal("hello   \nworld  ")).toBe("hello\nworld")
    })
  })

  describe("carriage return", () => {
    test("overwrites line from start", () => {
      expect(renderTerminal("hello\rworld")).toBe("world")
    })

    test("partial overwrite", () => {
      expect(renderTerminal("hello world\rhi")).toBe("hillo world")
    })

    test("progress bar simulation", () => {
      const input = "Progress: [    ] 0%\rProgress: [##  ] 50%\rProgress: [####] 100%"
      expect(renderTerminal(input)).toBe("Progress: [####] 100%")
    })
  })

  describe("cursor movement", () => {
    test("cursor up", () => {
      expect(renderTerminal("line1\nline2\x1b[1Aover")).toBe("line1over\nline2")
    })

    test("cursor up multiple", () => {
      expect(renderTerminal("a\nb\nc\x1b[2Ax")).toBe("ax\nb\nc")
    })

    test("cursor down", () => {
      expect(renderTerminal("line1\x1b[1Bline2")).toBe("line1\n     line2")
    })

    test("cursor forward", () => {
      expect(renderTerminal("hello\x1b[3Cworld")).toBe("hello   world")
    })

    test("cursor backward", () => {
      expect(renderTerminal("hello\x1b[2Dxx")).toBe("helxx")
    })

    test("cursor position", () => {
      expect(renderTerminal("aaa\nbbb\nccc\x1b[1;1HX")).toBe("Xaa\nbbb\nccc")
    })

    test("cursor home", () => {
      expect(renderTerminal("hello\x1b[HX")).toBe("Xello")
    })
  })

  describe("clear line", () => {
    test("clear to end of line (default)", () => {
      expect(renderTerminal("hello world\x1b[6D\x1b[K")).toBe("hello")
    })

    test("clear to end of line (explicit 0)", () => {
      expect(renderTerminal("hello world\x1b[6D\x1b[0K")).toBe("hello")
    })

    test("clear to start of line", () => {
      expect(renderTerminal("hello world\x1b[6D\x1b[1K")).toBe("      world")
    })

    test("clear entire line", () => {
      expect(renderTerminal("hello world\x1b[2K")).toBe("")
    })
  })

  describe("clear screen", () => {
    test("clear to end of screen", () => {
      expect(renderTerminal("line1\nline2\nline3\x1b[2;3H\x1b[J")).toBe("line1\nli")
    })

    test("clear entire screen", () => {
      expect(renderTerminal("line1\nline2\x1b[2J")).toBe("")
    })
  })

  describe("SGR (colors)", () => {
    test("strips color codes", () => {
      expect(renderTerminal("\x1b[31mred\x1b[0m normal")).toBe("red normal")
    })

    test("strips multiple color codes", () => {
      expect(renderTerminal("\x1b[1;31;44mbold red on blue\x1b[0m")).toBe("bold red on blue")
    })
  })

  describe("tabs", () => {
    test("expands tabs to 8-column stops", () => {
      expect(renderTerminal("a\tb")).toBe("a       b")
    })

    test("tabs align to next stop", () => {
      expect(renderTerminal("abc\td")).toBe("abc     d")
    })
  })

  describe("backspace", () => {
    test("moves cursor back", () => {
      expect(renderTerminal("hello\b\b\bXX")).toBe("heXXo")
    })
  })

  describe("complex scenarios", () => {
    test("watch-style output", () => {
      // Simulates `watch` command that clears and redraws
      const frame1 = "Every 2s: date\n\nMon Jan 1 12:00:00"
      const frame2 = "\x1b[H\x1b[2JEvery 2s: date\n\nMon Jan 1 12:00:02"
      expect(renderTerminal(frame1 + frame2)).toBe("Every 2s: date\n\nMon Jan 1 12:00:02")
    })

    test("npm progress style", () => {
      const input = "Downloading... 0%\rDownloading... 50%\rDownloading... 100%\nDone!"
      expect(renderTerminal(input)).toBe("Downloading... 100%\nDone!")
    })

    test("spinner animation", () => {
      const input = "Loading |\rLoading /\rLoading -\rLoading \\\rLoading |"
      expect(renderTerminal(input)).toBe("Loading |")
    })

    test("multi-line overwrite", () => {
      // Move up 2 lines, go to column 0, clear line, write new text
      const input = "Line 1\nLine 2\nLine 3\x1b[2A\r\x1b[2KNew Line 2"
      expect(renderTerminal(input)).toBe("New Line 2\nLine 2\nLine 3")
    })
  })
})
