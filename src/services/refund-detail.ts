import { money, refundStatus, type RefundRecord } from './order'

/** 退款记录和字典共同决定展示状态；未知状态不得显示为已完成。 */
export function refundPresentation(record?: RefundRecord) {
  if (!record) return { tone: 'neutral', title: '暂无退款记录', label: '暂无记录', description: '如刚提交申请，请稍后重新进入查看。', note: '提交退款申请后，可在此查看处理进度。' }
  const label = refundStatus(record.refundStatus)
  if (record.refundStatus === 'SUCCESS' || ['退款成功', '退款完成', '退款已完成', '已退款'].includes(label)) {
    return { tone: 'success', title: '退款已完成', label: '退款成功', description: `退款金额 ${money(record.refundAmount)}，请查收。`, note: '退款已完成。如对退款金额有疑问，可联系客服咨询。' }
  }
  if (['PROCESSING', 'REFUNDING', 'APPLYING', 'PENDING'].includes(record.refundStatus || '') || ['申请中', '退款申请中', '退款中', '处理中', '退款处理中', '待审核', '审核中'].includes(label)) {
    return { tone: 'processing', title: '退款处理中', label: '退款处理中', description: '您的退款申请正在处理，请留意退款进度。', note: '退款正在处理中，请留意支付账户通知。' }
  }
  if (['FAILED', 'FAIL', 'REJECTED'].includes(record.refundStatus || '') || ['退款失败', '已拒绝', '退款已拒绝', '拒绝退款'].includes(label)) {
    return { tone: 'failed', title: '退款未完成', label: label.startsWith('退款状态：') ? '退款未完成' : label, description: '本次退款未完成，请查看下方处理信息。', note: '如需了解退款处理情况，可联系客服咨询。' }
  }
  return { tone: 'neutral', title: '退款状态待确认', label: '待确认', description: '退款进度暂未确认，请稍后重新进入查看。', note: '如需了解退款处理情况，可联系客服咨询。' }
}
