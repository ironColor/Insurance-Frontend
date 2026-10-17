import Taro from '@tarojs/taro'

import type { ProductDocument } from './product'

const DOCUMENT_EVENT_PREFIX = 'insurance-product-document:'
let documentSequence = 0

/** 仅由对应文档页确认真实加载结果；打开路由不代表文档可阅读。 */
export function notifyProductDocumentResult(requestId: string | undefined, loaded: boolean): void {
  if (!requestId || !/^[\w-]{1,80}$/.test(requestId)) return
  Taro.eventCenter.trigger(`${DOCUMENT_EVENT_PREFIX}${requestId}`, loaded ? 'loaded' : 'failed')
}

export function validDocumentUrl(value?: string): string | null {
  if (!value || !/^https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(value)) return null
  return value
}

export async function copyDocumentUrl(url: string): Promise<void> {
  await Taro.setClipboardData({ data: url })
  await Taro.showToast({ title: '链接已复制，可在浏览器中打开', icon: 'none' })
}

/** 文本由页面使用 RichText 展示，远程链接和附件交由微信的对应能力打开。 */
export async function openProductDocument(document: ProductDocument): Promise<void> {
  if (document.url && /^http:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(document.url)) {
    const result = await Taro.showModal({
      title: '请在浏览器中查看',
      content: '该协议链接暂不支持在小程序内打开，可复制链接到浏览器中查看。',
      confirmText: '复制链接',
      cancelText: '稍后再试'
    })
    if (result.confirm) await copyDocumentUrl(document.url)
    throw new Error('该协议尚未在小程序中完成阅读，请联系客服确认')
  }
  const url = validDocumentUrl(document.url)
  if (!url) {
    await Taro.showToast({ title: '协议链接无效，请联系客服', icon: 'none' })
    throw new Error('协议链接无效')
  }
  if (document.contentType === 'file') {
    Taro.showLoading({ title: '正在打开文件', mask: true })
    try {
      const result = await Taro.downloadFile({ url, timeout: 30000 })
      if (result.statusCode !== 200) throw new Error('文件下载失败')
      await Taro.openDocument({ filePath: result.tempFilePath, showMenu: true })
    } catch {
      Taro.hideLoading()
      const result = await Taro.showModal({ title: '文件暂时无法打开', content: '可复制文件链接，在浏览器中查看。', confirmText: '复制链接', cancelText: '稍后再试' })
      if (result.confirm) await copyDocumentUrl(url)
      throw new Error('协议文件尚未成功打开')
    } finally {
      Taro.hideLoading()
    }
    return
  }
  const requestId = `${Date.now()}-${++documentSequence}`
  const eventName = `${DOCUMENT_EVENT_PREFIX}${requestId}`
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      Taro.eventCenter.off(eventName, receive)
      if (error) reject(error)
      else resolve()
    }
    const receive = (result: string) => finish(result === 'loaded' ? undefined : new Error('协议页面尚未成功加载'))
    const timeout = setTimeout(() => finish(new Error('协议页面加载超时，请重试')), 30000)
    Taro.eventCenter.on(eventName, receive)
    void Taro.navigateTo({
      url: `/pages/product-document/index?url=${encodeURIComponent(url)}&title=${encodeURIComponent(document.title)}&requestId=${requestId}`
    }).catch(() => finish(new Error('协议页面打开失败，请重试')))
  })
}
