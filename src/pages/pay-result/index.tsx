import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useOrder } from '../../hooks/use-order'
import { money, orderStatus } from '../../services/order'
import './index.css'

export default function PayResultPage() {
  const { order, loading, error, reload } = useOrder()
  const outcome = useRouter().params.outcome
  return <View className='result-page'>
    <View className='result-icon'>?</View><Text className='result-title'>支付结果核对</Text>
    <Text className='result-description'>{outcome === 'cancelled' ? '已取消微信支付操作；订单是否支付以服务端为准。' : '支付客户端结果不代表到账；请核对服务端订单。状态字典尚未提供，不自动判定支付成功。'}</Text>
    {loading && <View>正在查询…</View>}{error && <View>{error}</View>}
    {order && <View className='result-card'><View>订单号：{order.orderNo}</View><View>{orderStatus(order)}</View><View>订单金额：{money(order.totalAmount)}</View><View>实付金额：{money(order.payAmount)}</View><View>支付时间：{order.payTime || '未返回'}</View></View>}
    <Button disabled={loading} onClick={reload}>重新查询结果</Button>
    <Button onClick={() => Taro.redirectTo({ url: '/pages/orders/index' })}>查看我的订单</Button>
  </View>
}
