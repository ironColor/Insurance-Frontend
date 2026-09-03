import type { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.css'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.info('小程序启动')
  })

  return children
}

export default App

