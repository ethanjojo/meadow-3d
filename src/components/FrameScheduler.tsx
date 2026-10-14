import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/** Demand rendering limits GPU work, rather than merely skipping simulation updates. */
export function FrameScheduler({ fps, visible }: { fps: number; visible: boolean }) {
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    if (!visible || fps <= 0) return
    let handle = 0, last = 0
    const interval = 1000 / fps
    const tick = (now: number) => {
      if (now - last >= interval - .5) { last = now; invalidate() }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [fps, visible, invalidate])
  return null
}
