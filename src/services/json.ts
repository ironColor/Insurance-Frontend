/** 保留服务端 int64 标识的原始数值，避免 JSON.parse 先丢失精度。 */
export function parseApiJson(text: string): unknown {
  const safeJson = text.replace(/("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (token, quoted: string | undefined) => {
    if (quoted || /[.eE]/.test(token) || Number.isSafeInteger(Number(token))) return token
    return `"${token}"`
  })
  return JSON.parse(safeJson)
}
