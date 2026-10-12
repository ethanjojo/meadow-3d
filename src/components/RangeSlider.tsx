import { useId } from 'react'

export function RangeSlider({ label, value, onChange, vertical = false }: {
  label: string; value: number; onChange: (value: number) => void; vertical?: boolean
}) {
  const id = useId()
  const percent = Math.round(value * 100)
  return (
    <div className={`range-slider${vertical ? ' range-slider-vertical' : ''}`}>
      <div className="range-slider-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{percent}%</output>
      </div>
      <input id={id} type="range" min="0" max="100" step="1" value={percent}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        aria-valuetext={`${percent}%`} onChange={event => onChange(Number(event.currentTarget.value) / 100)} />
    </div>
  )
}
