import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/app.css'

function readInitialParams() {
  const params = new URLSearchParams(window.location.search)
  const year = Number.parseInt(params.get('year') ?? '', 10)
  const week = Number.parseInt(params.get('week') ?? '', 10)

  return {
    year: Number.isInteger(year) ? year : null,
    week: Number.isInteger(week) ? week : null,
    day: params.get('day') || null,
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App initial={readInitialParams()} />
  </StrictMode>,
)
