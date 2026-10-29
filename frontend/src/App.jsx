import ReportProvider from './context/ReportProvider.jsx'
import Workspace from './components/Workspace.jsx'

export default function App({ initial }) {
  return (
    <ReportProvider initial={initial}>
      <Workspace />
    </ReportProvider>
  )
}
