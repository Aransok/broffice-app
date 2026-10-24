export interface QuickLine {
  code: string
  quantity: number
}

/** "CF283A x 4", "70031 10", "70031;10" or just "70031" (quantity 1). */
export function parseQuickOrder(text: string): QuickLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match =
        line.match(/^(\S+?)(?:\s*[;,]\s*|\s+)(?:[xх×*]\s*)?(\d+)\s*(?:бр\.?)?$/i) ??
        line.match(/^(\S+?)\s*[xх×*]\s*(\d+)\s*(?:бр\.?)?$/i)
      if (!match) return { code: line.split(/[\s;,]+/)[0], quantity: 1 }
      return { code: match[1], quantity: Math.max(1, Number(match[2])) }
    })
}
