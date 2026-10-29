import { useReport } from '../../context/reportContext.js'

const MODES = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'general', label: 'General' },
]

export default function ModeToggle() {
  const { mode, setMode } = useReport()

  return (
    <div className="mode-toggle" role="tablist" aria-label="Vista">
      {MODES.map((item) => {
        const active = mode === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`btn-mode-${item.id}`}
            className={`mode-btn${active ? ' is-active' : ''}`}
            aria-selected={active}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
