import { useReport } from '../../context/reportContext.js'

export default function AppHeader() {
  const { loading, error, week, rangeLabel } = useReport()

  let subtitle = ''
  if (loading) {
    subtitle = 'Cargando semana…'
  } else if (error) {
    subtitle = 'Error cargando la semana'
  } else if (week != null) {
    subtitle = `Semana ${week} · ${rangeLabel}`
  }

  return (
    <header className="top">
      <img className="brand-logo" src="/static/logo-light-streamline.png" alt="DGEHM" />
      <div>
        <h1>Informe de Actividades</h1>
        <p className="subtitle" id="week-range">
          {subtitle}
        </p>
      </div>
    </header>
  )
}
