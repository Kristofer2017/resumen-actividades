import { createContext, useContext } from 'react'

export const ReportContext = createContext(null)

export function useReport() {
  const context = useContext(ReportContext)
  if (!context) {
    throw new Error('useReport debe usarse dentro de <ReportProvider>')
  }
  return context
}
