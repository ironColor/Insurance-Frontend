import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'

import { decodeProductScene, fetchProductConfig, ProductConfig, ProductUnavailableError } from '../services/product'
import { clearPendingProductEntry, isCurrentProductEntry, productEntryFromQuery, rememberProductEntry } from '../services/product-entry'
import { hasAuthSession } from '../services/session'

export function useProductConfig(): {
  config: ProductConfig | null
  loading: boolean
  error: string
  reload: () => void
  shareUser?: string
} {
  const router = useRouter()
  const [config, setConfig] = useState<ProductConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareUser, setShareUser] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const { productId, scene, shareUser: queryShareUser } = router.params

  useEffect(() => {
    let cancelled = false
    setConfig(null)
    setError('')
    setLoading(true)
    setShareUser(undefined)
    const entry = productEntryFromQuery({ productId, scene, shareUser: queryShareUser }, router.path)
    if (!entry) {
      setError('缺少有效的产品信息，请重新扫码或从首页选择产品')
      setLoading(false)
      return
    }
    const pending = rememberProductEntry(entry)
    if (!hasAuthSession()) {
      void Taro.reLaunch({ url: '/pages/login/index' })
      return
    }

    const load = async () => {
      try {
        // scene 可能是短码或 JSON，统一登录后交由服务器解码。
        const decoded = entry.scene ? await decodeProductScene(entry.scene) : { productId: entry.productId!, shareUser: entry.shareUser }
        if (cancelled || !isCurrentProductEntry(pending.key)) return
        const data = await fetchProductConfig(decoded.productId)
        if (cancelled || !isCurrentProductEntry(pending.key)) return
        setConfig(data)
        setShareUser(decoded.shareUser || entry.shareUser)
        clearPendingProductEntry(pending.key)
      } catch (reason) {
        if (cancelled || !isCurrentProductEntry(pending.key)) return
        if (!hasAuthSession()) {
          void Taro.reLaunch({ url: '/pages/login/index' })
          return
        }
        if (reason instanceof ProductUnavailableError) {
          clearPendingProductEntry(pending.key)
          void Taro.reLaunch({ url: '/pages/qr-expired/index' })
          return
        }
        setError(reason instanceof Error ? reason.message : '产品信息加载失败，请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [productId, scene, queryShareUser, router.path, attempt])

  return { config, loading, error, shareUser, reload: () => setAttempt((value) => value + 1) }
}
