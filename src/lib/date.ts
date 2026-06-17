export function getVietnamTodayDate(input: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(input)
}

export function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00+07:00`)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getDateRangeForLastDays(today: string, days: number) {
  return {
    from: addDaysToDateString(today, -days),
    to: today,
  }
}

export function getCurrentWeekRange(today: string) {
  const current = new Date(`${today}T00:00:00+07:00`)
  const day = current.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(current)
  monday.setDate(current.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  function format(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    from: format(monday),
    to: format(sunday),
  }
}
