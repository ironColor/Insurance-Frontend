import { Button, Text, Textarea, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'

import { INSURANCE_ORDERS_KEY, OrderRecord } from '../../services/product'

import './index.css'

const reasons = ['个人经济压力，无力续保', '保障方案不符合预期', '已选购其他保险产品', '短期不需要该保障', '对服务不满意', '其他']

export default function RefundApplyPage() {
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [reason, setReason] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [remark, setRemark] = useState('')
  useLoad((options) => {
    const orders = Taro.getStorageSync<OrderRecord[]>(INSURANCE_ORDERS_KEY) || []
    setOrder(orders.find((item) => item.id === options.id && item.status === '已支付') || null)
  })

  const submit = () => {
    if (!reason) return Taro.showToast({ title: '请选择退保原因', icon: 'none' })
    if (!accepted) return Taro.showToast({ title: '请先阅读并确认退款风险', icon: 'none' })
    Taro.showToast({ title: '退保申请暂不可提交', icon: 'none' })
  }

  if (!order) return <View className='refund-empty'>该订单当前不可申请退保<Button onClick={() => Taro.navigateBack()}>返回</Button></View>

  return (
    <View className='refund-page'>
      <View className='refund-card refund-amount'><Text>可退金额</Text><Text>待核算</Text><Text>最终金额以正式退保审核结果为准</Text></View>
      <View className='refund-card'><Text className='refund-heading'>订单信息</Text><View className='refund-line'><Text>订单号</Text><Text>{order.id}</Text></View><View className='refund-line'><Text>已缴保费</Text><Text>¥{order.totalPremium.toFixed(2)}</Text></View></View>
      <View className='refund-card'><Text className='refund-heading'>退保原因</Text>{reasons.map((item) => <View className='refund-choice' key={item} onClick={() => setReason(item)}><Text>{item}</Text><Text className={reason === item ? 'refund-radio selected' : 'refund-radio'}>{reason === item ? '✓' : ''}</Text></View>)}</View>
      <View className='refund-card'><Text className='refund-heading'>退款收款账户</Text><View className='refund-line'><Text>原路返回</Text><Text>原支付账户</Text></View></View>
      <View className='refund-card'><Text className='refund-heading'>备注说明（选填）</Text><Textarea maxlength={200} placeholder='可填写补充说明' value={remark} onInput={(event) => setRemark(event.detail.value)} /><Text className='refund-count'>{remark.length}/200</Text></View>
      <View className='refund-risk'>犹豫期后退保可能按保单现金价值计算，产生保费损失；保障也将按正式规则终止。具体金额与生效时间以审核结果为准。</View>
      <View className='refund-agree' onClick={() => setAccepted(!accepted)}><Text className={accepted ? 'refund-checkbox selected' : 'refund-checkbox'}>{accepted ? '✓' : ''}</Text><Text>本人已阅读并知晓以上退款风险，自愿申请退保</Text></View>
      <Button className='refund-submit' onClick={submit}>提交退款申请</Button>
    </View>
  )
}
