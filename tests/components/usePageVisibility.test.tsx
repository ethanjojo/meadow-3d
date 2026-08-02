import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { usePageVisibility } from '../../src/hooks/usePageVisibility'

const originalVisibility = Object.getOwnPropertyDescriptor(
  document,
  'visibilityState',
)

function VisibilityProbe() {
  const visible = usePageVisibility()
  return <output aria-label="visibility">{String(visible)}</output>
}

afterEach(() => {
  if (originalVisibility) {
    Object.defineProperty(document, 'visibilityState', originalVisibility)
  }
})

describe('usePageVisibility', () => {
  it('tracks when the page is hidden and visible again', () => {
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    render(<VisibilityProbe />)
    expect(screen.getByLabelText('visibility')).toHaveTextContent('true')

    act(() => {
      visibility = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByLabelText('visibility')).toHaveTextContent('false')

    act(() => {
      visibility = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.getByLabelText('visibility')).toHaveTextContent('true')
  })
})
