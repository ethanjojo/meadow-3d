import { describe, expect, it, vi } from 'vitest'
import { hasWebGLSupport } from '../../src/core/webgl'

describe('hasWebGLSupport', () => {
  it('accepts WebGL2 and falls back to WebGL1', () => {
    const webgl2 = vi.fn(() => ({ renderer: 'webgl2' }))
    expect(
      hasWebGLSupport(() => ({ getContext: webgl2 }) as never),
    ).toBe(true)

    const webgl1 = vi.fn((kind: string) =>
      kind === 'webgl' ? { renderer: 'webgl1' } : null,
    )
    expect(
      hasWebGLSupport(() => ({ getContext: webgl1 }) as never),
    ).toBe(true)
  })

  it('returns false when context creation fails', () => {
    expect(
      hasWebGLSupport(
        () =>
          ({
            getContext: () => {
              throw new Error('GPU unavailable')
            },
          }) as never,
      ),
    ).toBe(false)
  })
})
