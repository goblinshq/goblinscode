// Normalize text by removing single leading spaces after newlines
// This fixes issues where word-wrapped text has spurious leading spaces
// e.g. "hello\n world" -> "hello\nworld"
// Preserves intentional indentation (2+ spaces or tabs)
export function normalizeLineSpaces(text: string): string {
  return text.replace(/\n /g, "\n")
}
