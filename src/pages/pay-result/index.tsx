import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useOrder } from '../../hooks/use-order'
import { money, orderStateText, payStateText } from '../../services/order'
import './index.css'

function ResultRow({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <View className={`result-row${prominent ? ' result-row-prominent' : ''}`}>
    <Text className='result-row-label'>{label}</Text><Text className='result-row-value' selectable>{value}</Text>
  </View>
}

export default function PayResultPage() {
  const { order, loading, error, reload } = useOrder()
  const success = order?.payStatus === 'SUCCESS'
  return <View className='result-page'>
    <View className={`result-icon ${success ? 'result-success' : 'result-pending'}`}>{success ? '✓' : '?'}</View>
    <Text className='result-title'>支付结果</Text>
    {loading && <View className='result-feedback'><View className='result-spinner' /><Text>正在查询订单…</Text></View>}
    {error && <View className='result-feedback result-feedback-error'>{error}</View>}
    {order && <View className='result-card'>
      <ResultRow label='订单编号' value={order.orderNo} />
      <ResultRow label='订单状态' value={orderStateText(order)} />
      <ResultRow label='支付状态' value={payStateText(order)} />
      <ResultRow label='订单金额' value={money(order.totalAmount)} />
      <ResultRow label={success || order.payTime ? '实付金额' : '应付金额'} value={money(order.payAmount)} prominent />
      <ResultRow label='支付时间' value={order.payTime || '—'} />
    </View>}
    <View className='result-actions'>
      <Button className='result-primary' hoverClass='result-button-hover' disabled={loading} loading={loading} onClick={reload}>重新查询结果</Button>
      <Button className='result-secondary' hoverClass='result-button-hover' onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>查看我的订单</Button>
    </View>
  </View>
}
