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
  const [reasonsLoading, setReasonsLoading] = useState(true)
  const [reasonsError, setReasonsError] = useState('')
  const lock = useRef(false)
  const lifecycle = useOrderLifecycle()
  const loadReasons = async () => {
    const alive = lifecycle.capture()
    setReasons([]); setRefundReason(''); setReasonsLoading(true); setReasonsError('')
    try { const rows = await fetchDictionary('pay_refund_reason'); if (alive()) setReasons(rows) }
    catch (error) { if (alive()) setReasonsError(message(error)) }
    finally { if (alive()) setReasonsLoading(false) }
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

      const answer = await Taro.showModal({ title: '确认申请退款', content: '仅已支付且未超过保单生效时间的订单支持申请，退款金额以审核结果为准。确定提交？' })
      if (!isActive() || !answer.confirm) return
      const finish = beginOrderAction(order.orderNo, 'refund')
      try { await applyRefund(latest, refundReason, remark.trim()) } finally { finish() }
      if (!isActive()) return
      await Taro.redirectTo({ url: `/pages/refund-status/index?orderNo=${encodeURIComponent(order.orderNo)}` })
    } catch (error) { if (isActive()) setResult(`${message(error)}。若已提交，请先查询退款记录，不要重复申请。`) }
    finally { lock.current = false; if (lifecycle.capture()()) setBusy(false) }
  }
  if (!order) return <View className='refund-page'><View className='refund-empty'>
    <View className={loading || !error ? 'refund-spinner' : 'refund-error-mark'}>{loading || !error ? '' : '!'}</View>
    <Text className='refund-empty-title'>{loading || !error ? '正在查询订单' : '订单暂时无法加载'}</Text>
    <Text className='refund-empty-copy'>{loading || !error ? '请稍候，正在获取退款申请信息' : error}</Text>
    {!!error && <Button className='refund-submit' hoverClass='refund-button-hover' disabled={loading} onClick={reload}>重新查询</Button>}
  </View></View>
  return <View className='refund-page'>
    <View className='refund-card'>
      <Text className='refund-heading'>订单信息</Text>
      <View className='refund-line'><Text className='refund-label'>订单编号</Text><Text className='refund-value' selectable>{order.orderNo}</Text></View>
      <View className='refund-line refund-line-amount'><Text className='refund-label'>原订单实付</Text><Text className='refund-value'>{money(order.payAmount)}</Text></View>
      <Text className='refund-note'>退款金额以审核结果为准。</Text>
    </View>
    <View className='refund-card'>
      <View className='refund-section-heading'><Text className='refund-heading'>退款原因</Text><Text className='refund-required'>必选</Text></View>
      {reasons.map(item => <Button className={`refund-choice${refundReason === item.dictValue ? ' refund-choice-selected' : ''}`} hoverClass='refund-button-hover' key={item.dictValue} disabled={busy} onClick={() => setRefundReason(item.dictValue)}>
        <View className={`refund-radio${refundReason === item.dictValue ? ' selected' : ''}`}>{refundReason === item.dictValue ? '✓' : ''}</View><Text className='refund-choice-label'>{item.dictLabel}</Text>
      </Button>)}
      {reasonsLoading && <View className='refund-reasons-state'><View className='refund-spinner refund-spinner-small' /><Text>正在加载退款原因</Text></View>}
      {!reasonsLoading && !reasons.length && <View className='refund-reasons-empty'><Text>{reasonsError || '暂无可用退款原因，请稍后重试'}</Text><Button className='refund-secondary' hoverClass='refund-button-hover' disabled={busy} onClick={loadReasons}>重新加载原因</Button></View>}
    </View>
    <View className='refund-card'>
      <Text className='refund-heading'>退款收款账户</Text>
      <View className='refund-account'><View className='refund-account-icon' /><View className='refund-account-copy'><Text className='refund-account-title'>原路返回</Text><Text className='refund-account-description'>退回原支付账户</Text></View></View>
    </View>
    <View className='refund-card'>
      <Text className='refund-heading'>备注说明（选填）</Text>
      <Textarea className='refund-remark' maxlength={200} disabled={busy} value={remark} placeholder='可填写补充说明' placeholderClass='refund-remark-placeholder' onInput={event => setRemark(event.detail.value)} />
      <Text className='refund-count'>{remark.length}/200</Text>
    </View>
    <View className='refund-risk'><Text className='refund-risk-icon'>⚠︎</Text><Text className='refund-risk-copy'><Text className='refund-risk-title'>风险须知：</Text>仅已支付且未超过保单生效时间可申请。退款申请需审核，请确认申请信息无误后提交。</Text></View>
    <View className='refund-card refund-actions'>
      <Button className='refund-agree' hoverClass='refund-button-hover' disabled={busy} onClick={() => setAccepted(!accepted)}>
        <View className={`refund-checkbox${accepted ? ' selected' : ''}`}>{accepted ? '✓' : ''}</View><Text className='refund-agree-copy'>本人已阅读并清楚知晓以上退款风险，<Text className='refund-agree-emphasis'>自愿申请退款</Text></Text>
      </Button>
      {result && <View className='refund-feedback'>{result}</View>}
      {blockReason && <View className='refund-feedback'>{blockReason}</View>}
      <Button className='refund-submit' hoverClass='refund-button-hover' disabled={busy || loading || reasonsLoading || !accepted || !refundReason || !!blockReason} loading={busy} onClick={submit}>提交退保退款申请</Button>
    </View>
  </View>
}
