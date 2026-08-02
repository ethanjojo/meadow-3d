interface StaticFallbackProps {
  reason?: string
}

export function StaticFallback({
  reason = 'Tvoje zařízení tuto 3D scénu nezvládlo, ale louka může zůstat s tebou.',
}: StaticFallbackProps) {
  return (
    <figure className="static-fallback">
      <img src="/fallback-meadow.svg" alt="Klidná louka pod letní oblohou" />
      <figcaption>{reason}</figcaption>
    </figure>
  )
}
