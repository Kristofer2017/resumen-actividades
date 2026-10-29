import { useReport } from '../../context/reportContext.js'
import Hint from '../ui/Hint.jsx'
import Panel from '../ui/Panel.jsx'
import SectionHead from '../ui/SectionHead.jsx'
import TextAreaField from '../ui/TextAreaField.jsx'
import DayTabs from './DayTabs.jsx'

export default function DayView() {
  const { days, selectedDate, updateDayText, filledDaysLabel } = useReport()
  const selected = days.find((day) => day.date === selectedDate) ?? days[0] ?? null

  return (
    <Panel className="day-view">
      <SectionHead
        title={selected ? selected.label : 'Actividades del día'}
        chip={filledDaysLabel}
      />

      <DayTabs />

      <Hint>
        Una actividad por línea. No hace falta poner <code>--</code>.
      </Hint>

      <TextAreaField
        id="day-editor"
        className="day-editor"
        value={selected?.text ?? ''}
        onChange={(text) => {
          if (selected) updateDayText(selected.date, text)
        }}
        placeholder="Escribe las actividades de este día…"
        autoComplete="off"
        disabled={!selected}
      />
    </Panel>
  )
}
