import { Button, Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

import { getUserProfile, saveUserProfile } from '../../services/profile'

import './index.css'

export default function AvatarPage() {
  const [avatarUrl, setAvatarUrl] = useState(() => getUserProfile().avatarUrl)

  const choose = async (sourceType: 'camera' | 'album') => {
    try {
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: [sourceType] })
      if (result.tempFiles[0]?.tempFilePath) setAvatarUrl(result.tempFiles[0].tempFilePath)
    } catch {
      // 用户取消选择时保持当前头像。
    }
  }

  const save = () => {
    if (!avatarUrl) {
      Taro.showToast({ title: '请先选择头像', icon: 'none' })
      return
    }
    if (avatarUrl === getUserProfile().avatarUrl) {
      Taro.navigateBack()
      return
    }
    Taro.saveFile({ tempFilePath: avatarUrl }).then((result) => {
      if (!('savedFilePath' in result)) throw new Error('保存失败')
      saveUserProfile({ ...getUserProfile(), avatarUrl: result.savedFilePath })
      Taro.showToast({ title: '头像已保存', icon: 'success' })
      Taro.navigateBack()
    }).catch(() => Taro.showToast({ title: '头像保存失败，请重试', icon: 'none' }))
  }

  return (
    <View className='avatar-page'>
      <Text className='avatar-heading'>修改头像</Text>
      <Text className='avatar-hint'>点击拍照或从相册选择新头像</Text>
      <View className='avatar-preview'>{avatarUrl ? <Image src={avatarUrl} mode='aspectFill' /> : <Text>用</Text>}</View>
      <View className='avatar-options'>
        <Button onClick={() => choose('camera')}>拍照</Button>
        <Button onClick={() => choose('album')}>从相册选择</Button>
      </View>
      <Button className='avatar-save' onClick={save}>保存</Button>
    </View>
  )
}
