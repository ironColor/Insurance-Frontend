import { Button, Text, View } from '@tarojs/components'
import { useOrder } from '../../hooks/use-order'
import { money, refundStatus } from '../../services/order'
import './index.css'

function RefundRow({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <View className={`refund-status-row${prominent ? ' refund-status-row-prominent' : ''}`}>
    <Text className='refund-status-label'>{label}</Text><Text className='refund-status-value' selectable>{value}</Text>
  </View>
}

export default function RefundStatusPage() {
  const { order, loading, error, reload } = useOrder()
  const pending = loading || (!order && !error)
  return <View className='refund-status-page'>
    <View className='refund-status-hero'>
      <Text className='refund-status-title'>退款记录</Text>
      <Text className='refund-status-description'>查看退款进度及处理结果</Text>
    </View>
    {pending && <View className='refund-status-state'><View className='refund-status-spinner' /><Text className='refund-status-state-title'>正在查询退款记录</Text></View>}
    {!!error && <View className='refund-status-state'><View className='refund-status-state-icon'>!</View><Text className='refund-status-state-title'>退款记录暂时无法加载</Text><Text className='refund-status-state-copy'>{error}</Text></View>}
    {order && <>
      <View className='refund-status-card'>
        <Text className='refund-status-section-title'>订单信息</Text>
        <RefundRow label='订单编号' value={order.orderNo} />
        <RefundRow label='原订单实付' value={money(order.payAmount)} prominent />
      </View>
      {!order.refundList?.length && <View className='refund-status-state refund-status-state-empty'>
        <View className='refund-status-state-icon'>↺</View>
        <Text className='refund-status-state-title'>暂无退款记录</Text>
        <Text className='refund-status-state-copy'>如刚提交申请，请稍后刷新查看，勿重复申请。</Text>
      </View>}
      {order.refundList?.map((item, index) => <View className='refund-status-card' key={item.refundNo || index}>
        <View className='refund-status-record-heading'><Text className='refund-status-section-title'>退款记录 {index + 1}</Text><Text className={`refund-status-badge${item.refundStatus === 'SUCCESS' ? ' refund-status-badge-success' : ''}`}>{refundStatus(item.refundStatus)}</Text></View>
        <RefundRow label='退款编号' value={item.refundNo || '—'} />
        <RefundRow label='退款金额' value={money(item.refundAmount)} prominent />
        <RefundRow label='完成时间' value={item.refundTime || '—'} />
        {item.errorMsg && <View className='refund-status-error-copy'>{item.errorMsg}</View>}
      </View>)}
    </>}
    <Button className='refund-status-action' hoverClass='refund-status-button-hover' disabled={pending} loading={pending} onClick={reload}>刷新退款记录</Button>
  </View>
}
