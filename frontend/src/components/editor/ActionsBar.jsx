import { useRef } from 'react'
import { useReport } from '../../context/reportContext.js'
import Button from '../ui/Button.jsx'

export default function ActionsBar() {
  const { clearWeek, downloadPdf, downloadDocx, exportJson, importJson } =
    useReport()
  const fileInputRef = useRef(null)

  const runWithAlert = (action) => {
    action().catch((error) => window.alert(error.message))
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      await importJson(file)
    } catch (error) {
      window.alert(error.message)
    }
  }

  return (
    <footer className="actions">
      <div className="actions-group">
        <Button onClick={() => runWithAlert(exportJson)}>Exportar JSON</Button>
        <Button onClick={() => fileInputRef.current?.click()}>
          Importar JSON
        </Button>
        <input
          ref={fileInputRef}
          id="import-file"
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFileChange}
        />
        <Button onClick={() => runWithAlert(clearWeek)}>Limpiar semana</Button>
      </div>

      <div className="actions-group actions-downloads">
        <Button
          title="Descargar Word (.docx)"
          onClick={() => runWithAlert(downloadDocx)}
        >
          Descargar Word
        </Button>
        <Button variant="primary" onClick={() => runWithAlert(downloadPdf)}>
          Descargar PDF
        </Button>
      </div>
    </footer>
  )
}
