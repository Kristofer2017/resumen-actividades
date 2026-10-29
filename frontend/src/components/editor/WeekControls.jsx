import { useState } from 'react'
import { useReport } from '../../context/reportContext.js'
import Button from '../ui/Button.jsx'
import Field from '../ui/Field.jsx'

export default function WeekControls() {
  const { year, week, changeWeek, shiftWeek } = useReport()
  const [yearDraft, setYearDraft] = useState(year ?? '')
  const [weekDraft, setWeekDraft] = useState(week ?? '')

  const reset = () => {
    setYearDraft(year ?? '')
    setWeekDraft(week ?? '')
  }

  const commit = () => {
    const nextYear = Number(yearDraft)
    const nextWeek = Number(weekDraft)

    const validYear = Number.isInteger(nextYear) && nextYear >= 2000 && nextYear <= 2100
    const validWeek = Number.isInteger(nextWeek) && nextWeek >= 1 && nextWeek <= 53
    if (!validYear || !validWeek) {
      reset()
      return
    }

    if (nextYear === year && nextWeek === week) return
    changeWeek(nextYear, nextWeek)
  }

  return (
    <form
      className="week-controls"
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <Field label="Año" inline>
        <input
          id="year"
          type="number"
          min="2000"
          max="2100"
          value={yearDraft}
          onChange={(event) => setYearDraft(event.target.value)}
          onBlur={commit}
        />
      </Field>

      <Field label="Semana" inline>
        <input
          id="week"
          type="number"
          min="1"
          max="53"
          value={weekDraft}
          onChange={(event) => setWeekDraft(event.target.value)}
          onBlur={commit}
        />
      </Field>

      <Button
        id="btn-prev-week"
        title="Semana anterior"
        onClick={() => shiftWeek(-1)}
        disabled={year == null}
      >
        ←
      </Button>
      <Button
        id="btn-next-week"
        title="Semana siguiente"
        onClick={() => shiftWeek(1)}
        disabled={year == null}
      >
        →
      </Button>
    </form>
  )
}
