export function filledLabel(count) {
  return count === 1 ? '1 día con actividades' : `${count} días con actividades`
}

export function resumenLabel(hasResumen, filledCount) {
  if (hasResumen && filledCount > 0) return 'PDF prioriza resumen'
  if (hasResumen) return 'Resumen general'
  return 'Sin resumen'
}
