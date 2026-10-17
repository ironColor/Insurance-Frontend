import { Button, Text, View, WebView } from '@tarojs/components'
import Taro, { useRouter, useUnload } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import { copyDocumentUrl, notifyProductDocumentResult, validDocumentUrl } from '../../services/product-document'

import './index.css'

export default function ProductDocumentPage() {
  const { url: rawUrl, title, requestId } = useRouter().params
  let decodedUrl = rawUrl || ''
  let documentTitle = title || '产品协议'
  try { decodedUrl = decodeURIComponent(decodedUrl) } catch { /* 保留原值并校验。 */ }
  try { documentTitle = decodeURIComponent(documentTitle) } catch { /* 保留原值。 */ }
  const url = validDocumentUrl(decodedUrl)
  const [failed, setFailed] = useState(false)
  const resultSent = useRef(false)
  const notifyResult = (loaded: boolean) => {
    if (resultSent.current) return
    resultSent.current = true
    notifyProductDocumentResult(requestId, loaded)
  }

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: documentTitle })
    if (!url) notifyResult(false)
  }, [documentTitle, url])
  useUnload(() => notifyResult(false))

  if (url && !failed) return <WebView src={url} onLoad={() => notifyResult(true)} onError={() => { setFailed(true); notifyResult(false) }} />
  return (
    <View className='product-document-state'>
      <Text className='product-document-title'>协议暂时无法打开</Text>
      <Text>请稍后重试，或复制链接到浏览器查看。</Text>
      {url && <Button onClick={() => void copyDocumentUrl(url).catch(() => Taro.showToast({ title: '链接复制失败，请重试', icon: 'none' }))}>复制协议链接</Button>}
      {url && <Button onClick={() => setFailed(false)}>重新加载</Button>}
    </View>
  )
}
