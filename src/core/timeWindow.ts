/** Scene hours; equal endpoints mean a full day, and windows can cross midnight. */
export function isWithinHours(dayPhase: number, start: number, end: number) {
  const hour = ((dayPhase % 1 + 1) % 1) * 24
  return start === end || (start < end ? hour >= start && hour < end : hour >= start || hour < end)
}
