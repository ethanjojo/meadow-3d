type CanvasFactory = () => Pick<HTMLCanvasElement, 'getContext'>

export function hasWebGLSupport(
  createCanvas: CanvasFactory = () => document.createElement('canvas'),
) {
  try {
    const canvas = createCanvas()
    return Boolean(
      canvas.getContext('webgl2') ??
        canvas.getContext('webgl') ??
        canvas.getContext('experimental-webgl'),
    )
  } catch {
    return false
  }
}
