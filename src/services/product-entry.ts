import Taro from '@tarojs/taro'

import { hasAuthSession } from './session'

const ENTRY_STORAGE_KEY = 'insurance-pending-product-entry'
const PRODUCT_PAGES = new Set(['/pages/index/index', '/pages/plan/index', '/pages/insure/index', '/pages/order-confirm/index', '/pages/payment/index'])
const EXTERNAL_ENTRY_SCENES = new Set([1007, 1008, 1011, 1012, 1013, 1036, 1044, 1047, 1048, 1049])

export type ProductEntry = {
  productId?: string
  scene?: string
  shareUser?: string
  path: string
}

type PendingEntry = ProductEntry & { key: string }
type EntryQuery = Record<string, unknown>

let pendingEntry: PendingEntry | null | undefined
let entrySequence = 0

function validateEntryValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const result = value.trim()
  return result && result.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(result) ? result : undefined
}

/** 只在微信路由参数入口解码一次，持久化的规范化数据不再解码。 */
export function decodeEntryValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    // 将原始值交由服务端校验，避免 URIError 导致白屏。
  }
  return validateEntryValue(decoded)
}

function normalizeProductPath(path?: string): string {
  const normalized = path?.startsWith('/') ? path : `/${path || ''}`
  return PRODUCT_PAGES.has(normalized) ? normalized : '/pages/index/index'
}

export function productEntryFromQuery(query: EntryQuery = {}, path?: string): ProductEntry | null {
  const scene = decodeEntryValue(query.scene)
  const productId = decodeEntryValue(query.productId)
  if (!scene && !productId) return null
  return {
    path: normalizeProductPath(path),
    ...(scene ? { scene } : { productId }),
    shareUser: decodeEntryValue(query.shareUser)
  }
}

function sameEntry(left: ProductEntry, right: ProductEntry): boolean {
  return left.path === right.path && left.scene === right.scene && left.productId === right.productId && left.shareUser === right.shareUser
}

export function getPendingProductEntry(): PendingEntry | null {
  if (pendingEntry === undefined) {
    const stored = Taro.getStorageSync<PendingEntry>(ENTRY_STORAGE_KEY)
    const scene = validateEntryValue(stored?.scene)
    const productId = validateEntryValue(stored?.productId)
    pendingEntry = (scene || productId) && typeof stored?.key === 'string'
      ? { path: normalizeProductPath(stored.path), ...(scene ? { scene } : { productId }), shareUser: validateEntryValue(stored.shareUser), key: stored.key }
      : null
  }
  return pendingEntry
}

/** 每次外部扫码都生成新标识，旧请求不得覆盖或清掉后来的扫码入口。 */
export function rememberProductEntry(entry: ProductEntry, forceNew = false): PendingEntry {
  const previous = getPendingProductEntry()
  if (!forceNew && previous && sameEntry(previous, entry)) return previous
  const next = { ...entry, key: `${Date.now()}-${++entrySequence}` }
  pendingEntry = next
  Taro.setStorageSync(ENTRY_STORAGE_KEY, next)
  return next
}

export function isCurrentProductEntry(key: string): boolean {
  return getPendingProductEntry()?.key === key
}

export function clearPendingProductEntry(key: string): void {
  if (!isCurrentProductEntry(key)) return
  pendingEntry = null
  Taro.removeStorageSync(ENTRY_STORAGE_KEY)
}

export function buildProductUrl(path: string, productId: string, shareUser?: string): string {
  return `${normalizeProductPath(path)}?productId=${encodeURIComponent(productId)}${shareUser ? `&shareUser=${encodeURIComponent(shareUser)}` : ''}`
}

export function getProductEntryUrl(entry: ProductEntry): string {
  if (entry.scene) {
    return `${entry.path}?scene=${encodeURIComponent(entry.scene)}${entry.shareUser ? `&shareUser=${encodeURIComponent(entry.shareUser)}` : ''}`
  }
  return buildProductUrl(entry.path, entry.productId || '', entry.shareUser)
}

export function getLoginDestination(): string {
  const entry = getPendingProductEntry()
  return entry ? getProductEntryUrl(entry) : '/pages/home/index'
}

/** App 的 scene 是数字启动来源；产品 scene 只从 query.scene 读取。 */
export function captureProductLaunch(options: { query?: EntryQuery; path?: string; scene?: number }, coldLaunch: boolean): boolean {
  const entry = productEntryFromQuery(options.query, options.path)
  if (!entry) return false
  // 普通切回前台可能仍携带旧 query，不能把正在填写的页面重新跳回介绍页。
  if (!coldLaunch && !EXTERNAL_ENTRY_SCENES.has(options.scene || 0)) return false
  rememberProductEntry({ ...entry, path: '/pages/index/index' }, true)
  return true
}

export function openPendingProductEntry(): void {
  const entry = getPendingProductEntry()
  if (!entry) return
  const pages = Taro.getCurrentPages()
  const currentPath = pages[pages.length - 1]?.route
  if (!hasAuthSession() && currentPath === 'pages/login/index') return
  void Taro.reLaunch({ url: hasAuthSession() ? getProductEntryUrl(entry) : '/pages/login/index' })
}
