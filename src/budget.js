// Pure budget logic. Months are 'YYYY-MM' strings, dates are 'YYYY-MM-DD'.
//
// Data shape:
//   expenses: [{ id, name, frequency: 'monthly' | 'biweekly', startDate,
//                amounts: [{ from: 'YYYY-MM', amount }], categoryIds?, endMonth? }]
//   incomes:  [{ id, name, frequency, startDate, amounts, endMonth? }]   // same schedule as expenses
//   categories: [{ id, name }]
//   actuals:  { 'YYYY-MM': { [expenseId]: number } }
//   extras:   { 'YYYY-MM': [{ id, name, amount, categoryIds? }] }   // unplanned spending

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
  incomes: [],
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

export function scheduleText(expense) {
  if (expense.frequency === 'monthly') {
    return `Monthly on day ${Number(expense.startDate.slice(8, 10))}`
  }
  return `Every 2 weeks from ${shortDate(expense.startDate)}, ${expense.startDate.slice(0, 4)}`
}

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
  const planned = round(rows.reduce((sum, r) => sum + r.planned, 0))
  const difference = round(entered.reduce((sum, r) => sum + r.difference, 0) - extrasTotal)

  const paid = data.incomes
    .map((income) => ({ income, count: dueDates(income, ym).length }))
    .filter((p) => p.count > 0)
  const income = round(paid.reduce((sum, p) => sum + amountFor(p.income, ym) * p.count, 0))

  return {
    ym,
    rows,
    extras,
    planned,
    actual: round(entered.reduce((sum, r) => sum + r.actual, 0) + extrasTotal),
    difference,
    income,
    incomePayments: paid.reduce((sum, p) => sum + p.count, 0),
    // Rows with no actual yet are assumed to come in as planned.
    leftOver: round(income - planned + difference),
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

// ---- analysis ----

export const UNCATEGORIZED = 'uncategorized'

export const activeExpenses = (data) => data.expenses.filter((e) => !e.endMonth)

/** Works for expenses and unplanned spending, which both carry categoryIds. */
function inCategories(item, selected) {
  if (selected.length === 0) return true
  const ids = item.categoryIds ?? []
  if (ids.length === 0) return selected.includes(UNCATEGORIZED)
  return ids.some((id) => selected.includes(id))
}

/** One month's totals for the expenses and unplanned spending in `selected`. */
function spendingIn(summary, selected) {
  const rows = summary.rows.filter((r) => inCategories(r.expense, selected))
  const entered = rows.filter((r) => r.actual !== null)
  const extras = summary.extras.filter((x) => inCategories(x, selected))
  const extrasTotal = extras.reduce((sum, x) => sum + x.amount, 0)
  return {
    planned: round(rows.reduce((sum, r) => sum + r.planned, 0)),
    actual: round(entered.reduce((sum, r) => sum + r.actual, 0) + extrasTotal),
    difference: round(entered.reduce((sum, r) => sum + r.difference, 0) - extrasTotal),
    entered: entered.length + extras.length,
  }
}

/**
 * Totals for active expenses in any of the selected categories, biggest first.
 * Nothing selected means everything. Each expense counts once, however many of
 * the selected categories it is in. `month` also includes unplanned spending.
 */
export function analyzeExpenses(data, selected, nowYm) {
  const names = new Map(data.categories.map((c) => [c.id, c.name]))
  const sumPerMonth = (expenses) => expenses.reduce((sum, e) => sum + averagePerMonth(e), 0)

  const active = activeExpenses(data)
  const matching = active.filter((e) => inCategories(e, selected))
  const rows = matching
    .map((expense) => ({
      expense,
      perMonth: round(averagePerMonth(expense)),
      categoryNames: (expense.categoryIds ?? []).map((id) => names.get(id)).filter(Boolean),
    }))
    .sort((a, b) => b.perMonth - a.perMonth || a.expense.name.localeCompare(b.expense.name))

  return {
    rows,
    total: round(sumPerMonth(matching)),
    overall: round(sumPerMonth(active)),
    perYear: round(sumPerMonth(matching) * 12),
    biggest: rows[0] ?? null,
    month: spendingIn(monthSummary(data, nowYm), selected),
  }
}

/**
 * Planned and actual per category for a month, biggest plan first. Anything in two
 * categories counts in both, so the rows can add up to more than the month's total.
 */
export function categoryBreakdown(data, ym) {
  const summary = monthSummary(data, ym)
  return [...data.categories, { id: UNCATEGORIZED, name: 'Uncategorized' }]
    .map(({ id, name }) => ({ id, name, ...spendingIn(summary, [id]) }))
    .filter((row) => row.planned > 0 || row.entered > 0)
    .sort((a, b) => b.planned - a.planned || a.name.localeCompare(b.name))
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
function amountsWith(item, amount, nowYm) {
  if (amount === latestAmount(item)) return item.amounts
  return [...item.amounts.filter((a) => a.from < nowYm), { from: nowYm, amount }]
}

export function updateExpense(data, id, { name, amount, startDate, categoryIds }, nowYm) {
  const expenses = data.expenses.map((e) =>
    e.id === id
      ? { ...e, name, startDate, amounts: amountsWith(e, amount, nowYm), categoryIds }
      : e,
  )
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

export function addIncome(data, { name, amount, frequency, startDate }, id = crypto.randomUUID()) {
  const income = {
    id,
    name,
    frequency,
    startDate,
    amounts: [{ from: startDate.slice(0, 7), amount }],
  }
  return { ...data, incomes: [...data.incomes, income] }
}

export function updateIncome(data, id, { name, amount, startDate }, nowYm) {
  const incomes = data.incomes.map((i) =>
    i.id === id ? { ...i, name, startDate, amounts: amountsWith(i, amount, nowYm) } : i,
  )
  return { ...data, incomes }
}

/** Older income stops after this month, since this month's may already be paid. */
export function removeIncome(data, id, nowYm) {
  const income = data.incomes.find((i) => i.id === id)
  if (income.startDate.slice(0, 7) >= nowYm) {
    return { ...data, incomes: data.incomes.filter((i) => i.id !== id) }
  }
  return {
    ...data,
    incomes: data.incomes.map((i) => (i.id === id ? { ...i, endMonth: nowYm } : i)),
  }
}

export function addCategory(data, name, id = crypto.randomUUID()) {
  return { ...data, categories: [...data.categories, { id, name }] }
}

/** Expenses point at the category's id, so they keep it through a rename. */
export function renameCategory(data, id, name) {
  return {
    ...data,
    categories: data.categories.map((c) => (c.id === id ? { ...c, name } : c)),
  }
}

/** Also takes the category off every expense and unplanned item that has it. */
export function removeCategory(data, id) {
  const without = (item) =>
    item.categoryIds?.includes(id)
      ? { ...item, categoryIds: item.categoryIds.filter((c) => c !== id) }
      : item
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    expenses: data.expenses.map(without),
    extras: Object.fromEntries(
      Object.entries(data.extras).map(([ym, extras]) => [ym, extras.map(without)]),
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

/** Rows with no actual whose last payment date has passed. */
export const dueRows = (summary, today) =>
  summary.rows.filter((r) => r.actual === null && r.dates[r.dates.length - 1] <= today)

/** Enters the planned amount for every row that is due and has no actual yet. */
export function markDueAsPlanned(data, ym, today) {
  return dueRows(monthSummary(data, ym), today).reduce(
    (next, row) => setActual(next, ym, row.expense.id, row.planned),
    data,
  )
}

export function addExtra(data, ym, { name, amount, categoryIds = [] }, id = crypto.randomUUID()) {
  const extras = [...(data.extras[ym] ?? []), { id, name, amount, categoryIds }]
  return { ...data, extras: { ...data.extras, [ym]: extras } }
}

export function toggleExtraCategory(data, ym, id, categoryId) {
  const extras = (data.extras[ym] ?? []).map((x) =>
    x.id === id ? { ...x, categoryIds: toggleCategoryId(x.categoryIds ?? [], categoryId) } : x,
  )
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
