import { Button, Text, View } from '@tarojs/components'
import { useOrder } from '../../hooks/use-order'
import { money, refundStatus } from '../../services/order'
import './index.css'

export default function RefundStatusPage() {
  const { order, loading, error, reload } = useOrder()
  return <View className='refund-status-page'>
    <View className='refund-status-hero'><Text>服务端退款记录</Text><Text>申请受理不代表到账，请以退款记录和实际账户为准。</Text></View>
    {loading && <View>正在查询…</View>}{error && <View>{error}</View>}
    {order && <><View className='refund-status-card'>订单号：{order.orderNo}<View>原订单实付：{money(order.payAmount)}</View></View>
      {!order.refundList?.length && <View>暂未查询到退款记录；如刚提交请稍后刷新，不要重复申请。</View>}
      {order.refundList?.map((item, index) => <View className='refund-status-card' key={item.refundNo || index}><Text>{refundStatus(item.refundStatus)}</Text><View>退款编号：{item.refundNo || '未返回'}</View><View>退款金额：{money(item.refundAmount)}</View><View>完成时间：{item.refundTime || '未返回'}</View>{item.errorMsg && <View>{item.errorMsg}</View>}</View>)}
    </>}
    <Button disabled={loading} onClick={reload}>刷新退款记录</Button>
  </View>
}
