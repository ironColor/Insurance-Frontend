import { useEffect, useRef } from 'react'
import { useUnload } from '@tarojs/taro'
import { createLifecycleGuard } from '../services/order-safety'

export function useOrderLifecycle() {
  const guard = useRef<ReturnType<typeof createLifecycleGuard>>()
  if (!guard.current) guard.current = createLifecycleGuard()
  const lifecycle = guard.current
  useEffect(() => {
    lifecycle.activate()
    return () => lifecycle.dispose()
  }, [lifecycle])
  useUnload(() => lifecycle.dispose())
  // onHide is NOT unload: the native payment sheet can hide this page.
  return lifecycle
}
