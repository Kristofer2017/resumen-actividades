import { ReportContext } from './reportContext.js'
import { useReportEditor } from '../hooks/useReportEditor.js'

export default function ReportProvider({ initial, children }) {
  const report = useReportEditor(initial)
  return (
    <ReportContext.Provider value={report}>{children}</ReportContext.Provider>
  )
}
