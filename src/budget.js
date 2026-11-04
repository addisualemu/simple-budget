// Pure budget logic. Months are 'YYYY-MM' strings, dates are 'YYYY-MM-DD'.
//
// Data shape:
//   expenses: [{ id, name, frequency: 'monthly' | 'biweekly', startDate,
//                amounts: [{ from: 'YYYY-MM', amount }], categoryIds?, endMonth? }]
//   categories: [{ id, name }]
//   actuals:  { 'YYYY-MM': { [expenseId]: number } }
//   extras:   { 'YYYY-MM': [{ id, name, amount }] }   // unplanned spending

const DAY_MS = 86400000
const pad = (n) => String(n).padStart(2, '0')
const round = (n) => Math.round(n * 100) / 100

const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries' },
  { id: 'education', name: 'Education' },
  { id: 'eat-out', name: 'Eat out' },
]

export const emptyData = () => ({
  version: 1,
  expenses: [],
  categories: DEFAULT_CATEGORIES,
  actuals: {},
  extras: {},
})

export function isValidData(d) {
  return (
    !!d &&
    Array.isArray(d.expenses) &&
    typeof d.actuals === 'object' &&
    typeof d.extras === 'object'
  )
}

// ---- dates ----

export function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const currentYm = (now = new Date()) => todayStr(now).slice(0, 7)

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

const dayNumber = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

const dateFromDayNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10)

const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// ---- schedule ----

/** The dates an expense is due in a month: 0-1 for monthly, 0-3 for bi-weekly. */
export function dueDates(expense, ym) {
  const startMonth = expense.startDate.slice(0, 7)
  if (ym < startMonth) return []
  if (expense.endMonth && ym > expense.endMonth) return []

  if (expense.frequency === 'monthly') {
    const day = Math.min(Number(expense.startDate.slice(8, 10)), daysInMonth(ym))
    return [`${ym}-${pad(day)}`]
  }

  const start = dayNumber(expense.startDate)
  const first = dayNumber(`${ym}-01`)
  const last = first + daysInMonth(ym) - 1
  const dates = []
  let day = start + Math.max(0, Math.ceil((first - start) / 14)) * 14
  for (; day <= last; day += 14) dates.push(dateFromDayNumber(day))
  return dates
}

/** The per-payment amount in force for a month. */
export function amountFor(expense, ym) {
  let amount = expense.amounts[0].amount
  for (const entry of expense.amounts) if (entry.from <= ym) amount = entry.amount
  return amount
}

export const latestAmount = (expense) => expense.amounts[expense.amounts.length - 1].amount

export const averagePerMonth = (expense) =>
  expense.frequency === 'monthly' ? latestAmount(expense) : (latestAmount(expense) * 26) / 12

// ---- summaries ----

/**
 * `difference` is planned minus actual, so positive means under budget. It only
 * counts rows with an actual entered (plus unplanned spending), otherwise a
 * half-entered month would look massively under budget.
 */
export function monthSummary(data, ym) {
  const rows = data.expenses
    .map((expense) => {
      const dates = dueDates(expense, ym)
      if (dates.length === 0) return null
      const planned = round(amountFor(expense, ym) * dates.length)
      const actual = data.actuals[ym]?.[expense.id] ?? null
      const difference = actual === null ? null : round(planned - actual)
      return { expense, dates, planned, actual, difference }
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.dates[0].localeCompare(b.dates[0]) || a.expense.name.localeCompare(b.expense.name),
    )

  const extras = data.extras[ym] ?? []
  const extrasTotal = extras.reduce((sum, x) => sum + x.amount, 0)
  const entered = rows.filter((r) => r.actual !== null)

  return {
    ym,
    rows,
    extras,
    planned: round(rows.reduce((sum, r) => sum + r.planned, 0)),
    actual: round(entered.reduce((sum, r) => sum + r.actual, 0) + extrasTotal),
    difference: round(entered.reduce((sum, r) => sum + r.difference, 0) - extrasTotal),
    enteredCount: entered.length,
    hasEntries: entered.length > 0 || extras.length > 0,
  }
}

/** Summaries for up to `limit` months ending at nowYm, oldest first. */
export function history(data, nowYm, limit = 12) {
  const known = [
    ...data.expenses.map((e) => e.startDate.slice(0, 7)),
    ...Object.keys(data.actuals),
    ...Object.keys(data.extras),
  ].sort()
  if (known.length === 0) return []

  const oldestAllowed = addMonths(nowYm, -(limit - 1))
  let ym = known[0] > oldestAllowed ? known[0] : oldestAllowed
  const months = []
  for (; ym <= nowYm; ym = addMonths(ym, 1)) months.push(monthSummary(data, ym))
  return months
}

// ---- updates (each returns new data) ----

export function addExpense(
  data,
  { name, amount, frequency, startDate, categoryIds = [] },
  id = crypto.randomUUID(),
) {
  const expense = {
    id,
    name,
    frequency,
    startDate,
    categoryIds,
    amounts: [{ from: startDate.slice(0, 7), amount }],
  }
  return { ...data, expenses: [...data.expenses, expense] }
}

/** A new amount applies from nowYm onward, so past months keep their old plan. */
export function updateExpense(data, id, { name, amount, startDate, categoryIds }, nowYm) {
  const expenses = data.expenses.map((e) => {
    if (e.id !== id) return e
    const amounts =
      amount === latestAmount(e)
        ? e.amounts
        : [...e.amounts.filter((a) => a.from < nowYm), { from: nowYm, amount }]
    return { ...e, name, startDate, amounts, categoryIds }
  })
  return { ...data, expenses }
}

/**
 * Expenses that began before this month stop rather than vanish, so history stays
 * intact. If this month already has an actual, it stays through this month.
 */
export function removeExpense(data, id, nowYm) {
  const expense = data.expenses.find((e) => e.id === id)
  if (expense.startDate.slice(0, 7) >= nowYm) {
    const actuals = Object.fromEntries(
      Object.entries(data.actuals).map(([ym, month]) => {
        const rest = { ...month }
        delete rest[id]
        return [ym, rest]
      }),
    )
    return { ...data, actuals, expenses: data.expenses.filter((e) => e.id !== id) }
  }
  const endMonth = data.actuals[nowYm]?.[id] !== undefined ? nowYm : addMonths(nowYm, -1)
  return {
    ...data,
    expenses: data.expenses.map((e) => (e.id === id ? { ...e, endMonth } : e)),
  }
}

export function addCategory(data, name, id = crypto.randomUUID()) {
  return { ...data, categories: [...data.categories, { id, name }] }
}

/** Also takes the category off every expense that has it. */
export function removeCategory(data, id) {
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    expenses: data.expenses.map((e) =>
      e.categoryIds?.includes(id)
        ? { ...e, categoryIds: e.categoryIds.filter((c) => c !== id) }
        : e,
    ),
  }
}

export function toggleCategoryId(categoryIds, id) {
  return categoryIds.includes(id) ? categoryIds.filter((c) => c !== id) : [...categoryIds, id]
}

export function toggleExpenseCategory(data, expenseId, categoryId) {
  return {
    ...data,
    expenses: data.expenses.map((e) =>
      e.id === expenseId
        ? { ...e, categoryIds: toggleCategoryId(e.categoryIds ?? [], categoryId) }
        : e,
    ),
  }
}

/** Pass null to clear the actual. */
export function setActual(data, ym, id, value) {
  const month = { ...data.actuals[ym] }
  if (value === null) delete month[id]
  else month[id] = value
  return { ...data, actuals: { ...data.actuals, [ym]: month } }
}

export function addExtra(data, ym, { name, amount }, id = crypto.randomUUID()) {
  const extras = [...(data.extras[ym] ?? []), { id, name, amount }]
  return { ...data, extras: { ...data.extras, [ym]: extras } }
}

export function removeExtra(data, ym, id) {
  const extras = (data.extras[ym] ?? []).filter((x) => x.id !== id)
  return { ...data, extras: { ...data.extras, [ym]: extras } }
}

// ---- formatting ----

const moneyFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const wholeMoneyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const money = (n) => moneyFormat.format(n)
export const wholeMoney = (n) => wholeMoneyFormat.format(n)

export function differenceLabel(n) {
  if (n === 0) return 'On budget'
  return `${money(Math.abs(n))} ${n > 0 ? 'under' : 'over'}`
}

const utcDate = (dateStr) => new Date(`${dateStr}T00:00:00Z`)
const format = (options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options })

export const monthLabel = (ym) =>
  format({ month: 'long', year: 'numeric' }).format(utcDate(`${ym}-01`))
export const shortMonth = (ym) => format({ month: 'short' }).format(utcDate(`${ym}-01`))
export const shortDate = (date) => format({ month: 'short', day: 'numeric' }).format(utcDate(date))
