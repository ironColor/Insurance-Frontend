import { Button, Text, Textarea, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { useOrder } from '../../hooks/use-order'
import { applyRefund, DictItem, fetchDictionary, fetchOrder, message, money } from '../../services/order'
import { useOrderLifecycle } from '../../hooks/use-order-lifecycle'
import { beginOrderAction, orderActionBlockReason, pendingBlockReason } from '../../services/order-safety'
import './index.css'

export default function RefundApplyPage() {
  const { order, loading, error, reload, isCurrent } = useOrder()
  const [remark, setRemark] = useState('')
  const [reasons, setReasons] = useState<DictItem[]>([])
  const [refundReason, setRefundReason] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const lock = useRef(false)
  const lifecycle = useOrderLifecycle()
  const loadReasons = async () => {
    const alive = lifecycle.capture()
    setReasons([]); setRefundReason('')
    try { const rows = await fetchDictionary('pay_refund_reason'); if (alive()) setReasons(rows) }
    catch (error) { if (alive()) setResult(message(error)) }
  }
  useDidShow(() => { void loadReasons() })
  const blockReason = order ? orderActionBlockReason(order, 'refund') || pendingBlockReason(order.orderNo, 'refund') : ''
  const submit = async () => {
    const alive = lifecycle.capture()
    const isActive = () => alive() && isCurrent()
    if (!isActive() || !order || !accepted || !reasons.some(item => item.dictValue === refundReason) || lock.current) return
    if (blockReason) { setResult(blockReason); return }
    lock.current = true; setBusy(true)
    try {
      const latest = await fetchOrder(order.orderNo)
      if (!isActive()) return
      const reason = orderActionBlockReason(latest, 'refund') || pendingBlockReason(order.orderNo, 'refund')
      if (reason) throw new Error(reason)

      const answer = await Taro.showModal({ title: '确认申请退款', content: '仅已支付且未超过保单生效时间的订单支持申请，资格和退款金额由服务端审核。确定提交？' })
      if (!isActive() || !answer.confirm) return
      const finish = beginOrderAction(order.orderNo, 'refund')
      try { await applyRefund(latest, refundReason, remark.trim()) } finally { finish() }
      if (!isActive()) return
      await Taro.redirectTo({ url: `/pages/refund-status/index?orderNo=${encodeURIComponent(order.orderNo)}` })
    } catch (error) { if (isActive()) setResult(`${message(error)}。若已提交，请先查询退款记录，不要重复申请。`) }
    finally { lock.current = false; if (lifecycle.capture()()) setBusy(false) }
  }
  if (!order) return <View className='refund-empty'>{loading ? '正在查询订单' : error}<Button disabled={loading} onClick={reload}>重新查询</Button></View>
  return <View className='refund-page'>
    <View className='refund-card'><Text>订单号：{order.orderNo}</Text><View>原订单实付：{money(order.payAmount)}</View><View>可退金额由服务端审核，不按本地保费推算</View></View>
    <View className='refund-card'><Text>退款原因（必选）</Text>{reasons.map(item => <Button key={item.dictValue} disabled={busy} onClick={() => setRefundReason(item.dictValue)}>{refundReason === item.dictValue ? '✓ ' : ''}{item.dictLabel}</Button>)}{!reasons.length && <Button onClick={loadReasons}>重新加载退款原因</Button>}<Text>申请说明（选填）</Text><Textarea maxlength={200} value={remark} placeholder='补充退款说明' onInput={event => setRemark(event.detail.value)} /></View>
    <View className='refund-risk'>仅已支付且未超过保单生效时间可申请。申请受理不代表退款成功，实际进度及到账金额以服务端和支付账户为准。</View>
    <Button disabled={busy} onClick={() => setAccepted(!accepted)}>{accepted ? '✓ 已确认' : '阅读并确认退款风险'}</Button>
    {result && <View>{result}</View>}
    {blockReason && <View>{blockReason}</View>}
    <Button disabled={busy || !accepted || !refundReason || !!blockReason} loading={busy} onClick={submit}>提交退款申请</Button>
    <Button disabled={busy || loading} onClick={reload}>刷新订单及申请结果</Button>
    <Button disabled={busy} onClick={() => Taro.navigateTo({ url: `/pages/refund-status/index?orderNo=${encodeURIComponent(order.orderNo)}` })}>查询退款记录</Button>
  </View>
}
