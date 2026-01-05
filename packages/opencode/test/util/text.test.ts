import { describe, test, expect } from "bun:test"
import { normalizeLineSpaces } from "@/util/text"

describe("normalizeLineSpaces", () => {
  test("removes single leading space after newline", () => {
    expect(normalizeLineSpaces("hello\n world")).toBe("hello\nworld")
  })

  test("handles multiple lines with single leading spaces", () => {
    expect(normalizeLineSpaces("line1\n line2\n line3")).toBe("line1\nline2\nline3")
  })

  test("preserves double spaces (intentional indentation)", () => {
    expect(normalizeLineSpaces("hello\n  indented")).toBe("hello\n indented")
  })

  test("preserves tabs (intentional indentation)", () => {
    expect(normalizeLineSpaces("hello\n\tindented")).toBe("hello\n\tindented")
  })

  test("handles text without newlines", () => {
    expect(normalizeLineSpaces("hello world")).toBe("hello world")
  })

  test("handles empty string", () => {
    expect(normalizeLineSpaces("")).toBe("")
  })

  test("handles text with no leading spaces after newlines", () => {
    expect(normalizeLineSpaces("hello\nworld")).toBe("hello\nworld")
  })

  test("handles mixed cases", () => {
    expect(normalizeLineSpaces("a\n b\n  c\n\td")).toBe("a\nb\n c\n\td")
  })
})
