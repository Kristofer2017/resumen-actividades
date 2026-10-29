import { useReport } from '../../context/reportContext.js'
import Hint from '../ui/Hint.jsx'
import Panel from '../ui/Panel.jsx'
import SectionHead from '../ui/SectionHead.jsx'
import DayCard from './DayCard.jsx'

export default function WeekView() {
  const { days, filledDaysLabel } = useReport()

  return (
    <Panel className="week-view">
      <SectionHead title="Actividades por día" chip={filledDaysLabel} />

      <Hint>
        Una actividad por línea. No hace falta poner <code>--</code>.
      </Hint>

      <div className="days">
        {days.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>
    </Panel>
  )
}
