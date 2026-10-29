import { useReport } from '../../context/reportContext.js'
import TextAreaField from '../ui/TextAreaField.jsx'

export default function DayCard({ day }) {
  const { updateDayText } = useReport()
  const hasContent = Boolean((day.text || '').trim())

  return (
    <div className={`day-card${hasContent ? ' has-content' : ''}`}>
      <div className="day-head">
        <strong>
          {day.dayName} {day.dayNumber}
        </strong>
        <span className="meta">{day.label}</span>
      </div>

      <TextAreaField
        rows={4}
        value={day.text}
        onChange={(text) => updateDayText(day.date, text)}
        placeholder="Una actividad por línea…"
        autoComplete="off"
      />
    </div>
  )
}
