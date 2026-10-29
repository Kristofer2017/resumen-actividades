import { useState } from 'react'
import { useReport } from '../../context/reportContext.js'
import SuggestionsDialog from '../suggestions/SuggestionsDialog.jsx'
import Button from '../ui/Button.jsx'
import ModeToggle from './ModeToggle.jsx'
import WeekControls from './WeekControls.jsx'

export default function Toolbar() {
  const { year, week } = useReport()
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)

  return (
    <div className="toolbar">
      <ModeToggle />

      <div className="toolbar-actions">
        <WeekControls key={`${year ?? 'x'}-${week ?? 'x'}`} />
        <Button
          className="suggest"
          title="Sugerir actividades a partir de tus commits"
          onClick={() => setSuggestionsOpen(true)}
          aria-haspopup="dialog"
        >
          Sugerir
        </Button>
      </div>

      {suggestionsOpen ? (
        <SuggestionsDialog onClose={() => setSuggestionsOpen(false)} />
      ) : null}
    </div>
  )
}
