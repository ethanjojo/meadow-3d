import { useEffect, useState } from 'react'

function isPageVisible() {
  return document.visibilityState === 'visible'
}

export function usePageVisibility() {
  const [visible, setVisible] = useState(isPageVisible)

  useEffect(() => {
    const handleVisibilityChange = () => setVisible(isPageVisible())
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return visible
}
