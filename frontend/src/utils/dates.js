export function todayIso(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isoWeek(date = new Date()) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  )
  const weekday = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - weekday)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  return { year: target.getUTCFullYear(), week }
}

export function pickDefaultDay(days, wantedDay) {
  if (wantedDay && days.some((day) => day.date === wantedDay)) return wantedDay
  const today = todayIso()
  if (days.some((day) => day.date === today)) return today
  return days[0]?.date ?? null
}
