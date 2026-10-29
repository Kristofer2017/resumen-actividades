import { useReport } from '../../context/reportContext.js'
import ActionsBar from './ActionsBar.jsx'
import AppHeader from './AppHeader.jsx'
import DayView from './DayView.jsx'
import ExtrasPanel from './ExtrasPanel.jsx'
import GeneralView from './GeneralView.jsx'
import ProfilePanel from './ProfilePanel.jsx'
import Toolbar from './Toolbar.jsx'
import WeekView from './WeekView.jsx'

export default function EditorPane() {
  const { mode } = useReport()

  return (
    <aside className="editor">
      <AppHeader />
      <Toolbar />

      <div className="editor-scroll">
        <ProfilePanel />
        {mode === 'day' ? <DayView /> : null}
        {mode === 'week' ? <WeekView /> : null}
        {mode === 'general' ? <GeneralView /> : null}
        <ExtrasPanel />
      </div>

      <ActionsBar />
    </aside>
  )
}
