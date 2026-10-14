import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FrameScheduler } from '../../src/components/FrameScheduler'
const { invalidate } = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('@react-three/fiber', () => ({ useThree: (selector: (state: { invalidate: () => void }) => unknown) => selector({ invalidate }) }))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('limited GPU rendering', () => {
  it('invalidates at the requested rate and stops scheduling while hidden', () => {
    let callback: FrameRequestCallback | undefined
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', vi.fn((next: FrameRequestCallback) => { callback = next; return 1 }))
    vi.stubGlobal('cancelAnimationFrame', cancel)
    const { rerender } = render(<FrameScheduler fps={30} visible />)
    callback!(0); callback!(34); callback!(50); callback!(68)
    expect(invalidate).toHaveBeenCalledTimes(2)
    rerender(<FrameScheduler fps={30} visible={false} />)
    expect(cancel).toHaveBeenCalledWith(1)
  })
})
