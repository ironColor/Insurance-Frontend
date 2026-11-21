import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useOrder } from '../../hooks/use-order'
import { parseOrderDetail } from '../../services/order-detail'
import './index.css'

function DetailLine({ label, value }: { label: string; value: string }) {
  return <View className='order-detail-line'>
    <Text className='order-detail-label'>{label}</Text><Text className='order-detail-value' selectable>{value}</Text>
  </View>
}
const dateText = (value?: string) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0].replace(/-/g, '.') || '待确认'

export default function OrderDetailPage() {
  const { order, error, loading, reload, fieldLabels } = useOrder({ includeFieldLabels: true })
  const back = () => { void Taro.navigateBack().catch(() => Taro.redirectTo({ url: '/pages/orders/index' })) }
  if (!order) return <View className='order-detail-page'><View className='detail-empty'>
    <View className={loading || !error ? 'detail-spinner' : 'detail-error-mark'}>{loading || !error ? '' : '!'}</View>
    <Text className='detail-empty-title'>{loading || !error ? '正在查询订单' : '订单暂时无法加载'}</Text>
    {!!error && <><Text className='detail-empty-copy'>{error}</Text><Button className='order-detail-action' hoverClass='detail-button-hover' onClick={reload} disabled={loading}>重新查询</Button></>}
  </View></View>
  const detail = parseOrderDetail(order, fieldLabels)
  const start = dateText(order.policyEffectiveDate)
  const end = dateText(order.policyExpiryDate)
  const period = start === '待确认' && end === '待确认' ? '待确认' : `${start}–${end}`
  return <View className='order-detail-page'>
    <View className='order-detail-content'>
      <View className='order-detail-card'>
      <Text className='order-detail-title'>{detail.productName || order.productName || order.productTitle || '保险产品'}</Text>
      {detail.plans.length ? detail.plans.map((plan, index) => <View className='order-detail-plan' key={index}>
        <DetailLine label={`产品名称${index + 1}`} value={plan.name} />
        <DetailLine label='承保公司' value={plan.company} />
        <DetailLine label='保障计划' value={plan.plans} />
        <DetailLine label='缴费方式' value='全额缴纳' />
        <DetailLine label='保障时间范围' value={period} />
      </View>) : <Text className='order-detail-muted'>暂无保障方案信息</Text>}
      </View>
      {detail.sections.length ? detail.sections.map((section, index) => <View className='order-detail-section order-detail-card' key={index}>
        <Text className='order-detail-section-title'>{section.name}</Text>
        {section.fields.map(field => <DetailLine key={field.name} label={field.label} value={field.value} />)}
      </View>) : <View className='order-detail-section order-detail-card'><Text className='order-detail-section-title'>投保信息</Text><Text className='order-detail-muted'>暂无投保信息</Text></View>}
      {detail.hasMissingLabels && <Text className='order-detail-muted'>{loading ? '正在获取信息名称…' : '部分信息名称暂未获取，请重新进入查看。'}</Text>}
    </View>
    <View className='order-detail-actions'>
      <Button className='order-detail-action' hoverClass='detail-button-hover' onClick={back}>返回</Button>
    </View>
  </View>
}
