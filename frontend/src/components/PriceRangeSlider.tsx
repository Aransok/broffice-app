interface PriceRangeSliderProps {
  bounds: [number, number]
  value: [number, number]
  onChange: (value: [number, number]) => void
}

/**
 * Two overlapping native range inputs, each transparent with pointer-events
 * disabled on the track and re-enabled only on the thumb — the standard
 * technique for a dual-handle slider without a extra dependency. Purely a
 * convenience on top of the manual min/max number inputs (spec #1): both
 * stay in sync, neither replaces the other.
 */
export function PriceRangeSlider({ bounds, value, onChange }: PriceRangeSliderProps) {
  const [boundMin, boundMax] = bounds
  const [min, max] = value

  function handleMinChange(next: number) {
    onChange([Math.min(next, max), max])
  }

  function handleMaxChange(next: number) {
    onChange([min, Math.max(next, min)])
  }

  const thumbClass =
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 ' +
    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 ' +
    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary'

  return (
    <div className="relative h-4 w-full min-w-[160px]">
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-slate-200" />
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
        style={{
          left: `${((min - boundMin) / (boundMax - boundMin)) * 100}%`,
          right: `${100 - ((max - boundMin) / (boundMax - boundMin)) * 100}%`,
        }}
      />
      <input
        type="range"
        min={boundMin}
        max={boundMax}
        value={min}
        onChange={(event) => handleMinChange(Number(event.target.value))}
        className={`absolute top-0 h-4 w-full appearance-none bg-transparent pointer-events-none ${thumbClass}`}
      />
      <input
        type="range"
        min={boundMin}
        max={boundMax}
        value={max}
        onChange={(event) => handleMaxChange(Number(event.target.value))}
        className={`absolute top-0 h-4 w-full appearance-none bg-transparent pointer-events-none ${thumbClass}`}
      />
    </div>
  )
}
