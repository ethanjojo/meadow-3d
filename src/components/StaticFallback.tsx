interface StaticFallbackProps {
  reason?: string
}

export function StaticFallback({
  reason = 'Your device could not render this 3D scene, but the meadow can stay with you.',
}: StaticFallbackProps) {
  return (
    <figure className="static-fallback">
      <img src="/fallback-meadow.svg" alt="Calm meadow under a summer sky" />
      <figcaption>{reason}</figcaption>
    </figure>
  )
}
