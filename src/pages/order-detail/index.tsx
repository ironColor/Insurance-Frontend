import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useOrder } from '../../hooks/use-order'
import { money, orderStateText, payStateText } from '../../services/order'
import { parseOrderDetail } from '../../services/order-detail'
import { orderActionBlockReason } from '../../services/order-safety'
import './index.css'

function DetailLine({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <View className={`order-detail-line${prominent ? ' prominent' : ''}`}>
    <Text className='order-detail-label'>{label}</Text><Text className='order-detail-value' selectable>{value}</Text>
  </View>
}

export default function OrderDetailPage() {
  const { order, error, loading, reload, fieldLabels } = useOrder({ includeFieldLabels: true })
  const navigate = (page: string) => order && Taro.navigateTo({ url: `/pages/${page}/index?orderNo=${encodeURIComponent(order.orderNo)}` })
  if (!order) return <View className='order-detail-page'><View className='detail-empty'>
    <View className={loading || !error ? 'detail-spinner' : 'detail-error-mark'}>{loading || !error ? '' : '!'}</View>
    <Text className='detail-empty-title'>{loading || !error ? '正在查询订单' : '订单暂时无法加载'}</Text>
    {!!error && <><Text className='detail-empty-copy'>{error}</Text><Button className='order-detail-action' hoverClass='detail-button-hover' onClick={reload} disabled={loading}>重新查询</Button></>}
  </View></View>
  const detail = parseOrderDetail(order, fieldLabels)
  const canPay = !orderActionBlockReason(order, 'pay')
  const canRefund = !orderActionBlockReason(order, 'refund')
  const tone = order.orderStatus === 'PAID' ? 'paid' : canPay ? 'pending' : 'neutral'
  return <View className='order-detail-page'>
    <View className={`order-detail-status order-detail-status-${tone}`}>
      <Text className='order-detail-status-title'>{orderStateText(order)}</Text>
      <Text className='order-detail-status-caption'>支付状态 · {payStateText(order)}</Text>
    </View>
    <View className='order-detail-card'>
      <Text className='order-detail-eyebrow'>保障方案</Text>
      <Text className='order-detail-title'>{detail.productName || order.productName || order.productTitle || '保险产品'}</Text>
      {detail.plans.length ? detail.plans.map((plan, index) => <View className='order-detail-plan' key={index}>
        <Text className='order-detail-plan-title'>{plan.name}</Text>
        <DetailLine label='承保公司' value={plan.company} />
        <DetailLine label='保障计划' value={plan.plans} />
        <DetailLine label='缴费方式' value='全额缴纳' />
      </View>) : <Text className='order-detail-muted'>暂无保障方案信息</Text>}
      <View className='order-detail-period'>
        <DetailLine label='生效时间' value={order.policyEffectiveDate || '待确认'} />
        <DetailLine label='终止时间' value={order.policyExpiryDate || '待确认'} />
      </View>
      <Text className='order-detail-note'>保障信息以正式保单为准。</Text>
    </View>
    {detail.sections.length ? detail.sections.map((section, index) => <View className='order-detail-card' key={index}>
      <Text className='order-detail-section-title'>{section.name}</Text>
      {section.fields.map(field => <DetailLine key={field.name} label={field.label} value={field.value} />)}
    </View>) : <View className='order-detail-card'><Text className='order-detail-section-title'>投保信息</Text><Text className='order-detail-muted'>暂无投保信息</Text></View>}
    {detail.hasMissingLabels && <Text className='order-detail-note'>{loading ? '正在获取信息名称…' : '部分信息名称暂未获取，请刷新订单重试。'}</Text>}
    <View className='order-detail-card'>
      <Text className='order-detail-section-title'>订单信息</Text>
      <DetailLine label='订单编号' value={order.orderNo} />
      <DetailLine label='订单金额' value={money(order.totalAmount)} />
      <DetailLine label={canPay ? '应付金额' : '支付金额'} value={money(order.payAmount)} prominent />
      <DetailLine label='下单时间' value={order.createTime || '—'} />
      <DetailLine label='支付时间' value={order.payTime || '—'} />
    </View>
    <View className='order-detail-actions'>
      {canPay && <Button className='order-detail-action' hoverClass='detail-button-hover' onClick={() => navigate('payment')}>继续支付</Button>}
      {canRefund && <Button className='order-detail-action' hoverClass='detail-button-hover' onClick={() => navigate('refund-apply')}>申请退款</Button>}
      <View className='order-detail-secondary-actions'>
        <Button className='order-detail-secondary' hoverClass='detail-button-hover' onClick={() => navigate('refund-status')}>退款记录</Button>
        <Button className='order-detail-secondary' hoverClass='detail-button-hover' disabled={loading} onClick={reload}>刷新订单</Button>
      </View>
    </View>
  </View>
}
