import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useOrder } from '../../hooks/use-order'
import { money, refundReasonText } from '../../services/order'
import { parseOrderDetail } from '../../services/order-detail'
import { refundPresentation } from '../../services/refund-detail'
import './index.css'

function RefundRow({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <View className={`refund-status-row${prominent ? ' refund-status-row-prominent' : ''}`}>
    <Text className='refund-status-label'>{label}</Text><Text className='refund-status-value' selectable>{value}</Text>
  </View>
}

export default function RefundStatusPage() {
  const { order, loading, error, reload, fieldLabels } = useOrder({ includeFieldLabels: true, includeRefundData: true })
  const back = () => { void Taro.navigateBack().catch(() => Taro.redirectTo({ url: order ? `/pages/order-detail/index?orderNo=${encodeURIComponent(order.orderNo)}` : '/pages/orders/index' })) }
  if (!order) return <View className='refund-status-page'><View className='refund-status-state'>
    <View className={loading || !error ? 'refund-status-spinner' : 'refund-status-state-icon'}>{loading || !error ? '' : '!'}</View>
    <Text className='refund-status-state-title'>{loading || !error ? '正在查询退款详情' : '退款详情暂时无法加载'}</Text>
    {!!error && <><Text className='refund-status-state-copy'>{error}</Text><Button className='refund-status-action' hoverClass='refund-status-button-hover' onClick={reload}>重新查询</Button></>}
  </View></View>
  const presentation = refundPresentation(order.refundList?.[0])
  const detail = parseOrderDetail(order, fieldLabels)
  return <View className={`refund-status-page refund-status-${presentation.tone}`}>
    <View className='refund-status-card refund-status-hero'>
      <View className='refund-status-hero-icon'>{presentation.tone === 'success' ? '✓' : presentation.tone === 'processing' ? '◷' : presentation.tone === 'failed' ? '!' : '?'}</View>
      <Text className='refund-status-title'>{presentation.title}</Text>
      <Text className='refund-status-description'>{presentation.description}</Text>
      <View className='refund-status-badge'><View className='refund-status-badge-dot' /><Text>{presentation.label}</Text></View>
    </View>
    {order.refundList?.map((item, index) => <View className='refund-status-card' key={item.refundNo || index}>
      <View className='refund-status-section-heading'><Text className='refund-status-section-icon'>＄</Text><Text className='refund-status-section-title'>{index ? '历史退款信息' : '退款信息'}</Text></View>
      <RefundRow label='退款金额' value={money(item.refundAmount)} prominent />
      <RefundRow label='退款方式' value={String(item.refundChannel) === '1' ? '原路返回' : String(item.refundChannel) === '2' ? '银行卡' : String(item.refundChannel) === '3' ? '其他' : '待确认'} />
      <RefundRow label='退款账户' value={String(item.refundChannel) === '1' ? order.pay?.payChannelName || '原支付账户' : '—'} />
      <View className='refund-status-divider' />
      <RefundRow label='申请时间' value={item.createTime || '—'} />
      <RefundRow label='退款原因' value={refundReasonText(item.refundReason)} />
      {item.refundTime && <RefundRow label='完成时间' value={item.refundTime} />}
      {!!index && <RefundRow label='退款状态' value={refundPresentation(item).label} />}
      {item.errorMsg && <View className='refund-status-error-copy'>{item.errorMsg}</View>}
    </View>)}
    <View className='refund-status-card'>
      <View className='refund-status-section-heading'><Text className='refund-status-section-icon'>▧</Text><Text className='refund-status-section-title'>订单信息</Text></View>
      <RefundRow label='订单编号' value={order.orderNo} />
      {order.pay?.transactionId && <RefundRow label='支付交易号' value={order.pay.transactionId} />}
      <RefundRow label='产品名称' value={detail.productName || order.productName || order.productTitle || '—'} />
    </View>
    {detail.sections.map((section, index) => <View className='refund-status-card' key={index}>
      <Text className='refund-status-section-title'>{section.name}</Text>
      {section.fields.map(field => <RefundRow key={field.name} label={field.label} value={field.value} />)}
    </View>)}
    <View className='refund-status-card refund-status-footer'>
      <View className='refund-status-note'><Text className='refund-status-note-icon'>ⓘ</Text><Text className='refund-status-note-copy'>{presentation.note}</Text></View>
      <Button className='refund-status-action' hoverClass='refund-status-button-hover' onClick={back}>返回</Button>
    </View>
  </View>
}
