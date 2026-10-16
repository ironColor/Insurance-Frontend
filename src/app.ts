import type { PropsWithChildren } from 'react'
import { useDidShow, useLaunch } from '@tarojs/taro'
import { useRef } from 'react'

import { captureProductLaunch, openPendingProductEntry } from './services/product-entry'

import './app.css'

function App({ children }: PropsWithChildren) {
  const initialShow = useRef(true)
  useLaunch((options) => {
    captureProductLaunch(options, true)
  })

  useDidShow((options) => {
    if (initialShow.current) {
      initialShow.current = false
      return
    }
    if (options && captureProductLaunch(options, false)) openPendingProductEntry()
  })

  return children
}

export default App

