import { useReport } from '../../context/reportContext.js'

export default function DayTabs() {
  const { days, selectedDate, selectDay } = useReport()

  return (
    <div className="day-tabs" role="tablist" aria-label="Días de la semana">
      {days.map((day) => {
        const active = day.date === selectedDate
        const hasContent = Boolean((day.text || '').trim())
        const classes = [
          'day-tab',
          active && 'is-active',
          hasContent && 'has-content',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            className={classes}
            aria-selected={active}
            onClick={() => selectDay(day.date)}
          >
            {day.dayName.slice(0, 3)}
            <small>{day.dayNumber}</small>
          </button>
        )
      })}
    </div>
  )
}
