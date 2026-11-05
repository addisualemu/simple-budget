import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addCategory,
  analyzeExpenses,
  addExpense,
  addExtra,
  addIncome,
  addMonths,
  amountFor,
  dueDates,
  emptyData,
  history,
  markDueAsPlanned,
  monthSummary,
  removeCategory,
  removeExpense,
  removeIncome,
  renameCategory,
  setActual,
  toggleExpenseCategory,
  UNCATEGORIZED,
  updateExpense,
  updateIncome,
} from './budget.js'

const monthly = (startDate = '2026-01-15', amount = 100) => ({
  id: 'm',
  name: 'Rent',
  frequency: 'monthly',
  startDate,
  amounts: [{ from: startDate.slice(0, 7), amount }],
})
const biweekly = (startDate = '2026-01-02', amount = 50) => ({
  id: 'b',
  name: 'Daycare',
  frequency: 'biweekly',
  startDate,
  amounts: [{ from: startDate.slice(0, 7), amount }],
})

test('addMonths crosses year boundaries', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', -1), '2025-12')
  assert.equal(addMonths('2026-03', -14), '2025-01')
})

test('monthly due date clamps to short months and respects start and end', () => {
  const e = monthly('2026-01-31')
  assert.deepEqual(dueDates(e, '2026-02'), ['2026-02-28'])
  assert.deepEqual(dueDates(e, '2025-12'), [])
  assert.deepEqual(dueDates({ ...e, endMonth: '2026-03' }, '2026-04'), [])
})

test('bi-weekly dates land 14 days apart, giving 3 payments in some months', () => {
  const e = biweekly('2026-01-02')
  assert.deepEqual(dueDates(e, '2026-01'), ['2026-01-02', '2026-01-16', '2026-01-30'])
  assert.deepEqual(dueDates(e, '2026-02'), ['2026-02-13', '2026-02-27'])
  // Crosses the March DST change without drifting.
  assert.deepEqual(dueDates(e, '2026-03'), ['2026-03-13', '2026-03-27'])
  const year = Array.from({ length: 12 }, (_, i) => dueDates(e, addMonths('2026-01', i)).length)
  assert.equal(
    year.reduce((a, b) => a + b),
    26,
  )
})

test('bi-weekly starting mid-month skips dates before the start', () => {
  assert.deepEqual(dueDates(biweekly('2026-01-20'), '2026-01'), ['2026-01-20'])
})

test('difference only counts entered rows, and unplanned spending reduces it', () => {
  let data = { ...emptyData(), expenses: [monthly(), biweekly()] }
  data = setActual(data, '2026-01', 'm', 120)
  let s = monthSummary(data, '2026-01')
  assert.equal(s.planned, 250)
  assert.equal(s.actual, 120)
  assert.equal(s.difference, -20)
  assert.equal(s.enteredCount, 1)

  data = setActual(data, '2026-01', 'b', 140)
  data = addExtra(data, '2026-01', { name: 'Tire', amount: 15.5 }, 'x')
  s = monthSummary(data, '2026-01')
  assert.equal(s.actual, 275.5)
  assert.equal(s.difference, -25.5)
})

test('an actual of 0 counts as entered; null clears it', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = setActual(data, '2026-01', 'm', 0)
  assert.equal(monthSummary(data, '2026-01').rows[0].difference, 100)
  data = setActual(data, '2026-01', 'm', null)
  assert.equal(monthSummary(data, '2026-01').hasEntries, false)
})

test('changing an amount keeps earlier months at the old plan', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = updateExpense(data, 'm', { name: 'Rent', amount: 130, startDate: '2026-01-15' }, '2026-06')
  const [e] = data.expenses
  assert.equal(amountFor(e, '2026-05'), 100)
  assert.equal(amountFor(e, '2026-06'), 130)
  assert.equal(amountFor(e, '2026-09'), 130)
})

test('changing an amount twice in one month keeps one entry', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = updateExpense(data, 'm', { name: 'Rent', amount: 130, startDate: '2026-01-15' }, '2026-06')
  data = updateExpense(data, 'm', { name: 'Rent', amount: 140, startDate: '2026-01-15' }, '2026-06')
  assert.equal(data.expenses[0].amounts.length, 2)
  assert.equal(amountFor(data.expenses[0], '2026-06'), 140)
})

test('removing an older expense keeps it in past months', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = removeExpense(data, 'm', '2026-06')
  assert.equal(monthSummary(data, '2026-05').rows.length, 1)
  assert.equal(monthSummary(data, '2026-06').rows.length, 0)
})

test('removing keeps the current month if it already has an actual', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = setActual(data, '2026-06', 'm', 90)
  data = removeExpense(data, 'm', '2026-06')
  assert.equal(monthSummary(data, '2026-06').rows.length, 1)
  assert.equal(monthSummary(data, '2026-07').rows.length, 0)
})

test('removing an expense added this month deletes it outright', () => {
  let data = addExpense(
    emptyData(),
    { name: 'Gym', amount: 30, frequency: 'monthly', startDate: '2026-06-01' },
    'g',
  )
  data = setActual(data, '2026-06', 'g', 30)
  data = removeExpense(data, 'g', '2026-06')
  assert.equal(data.expenses.length, 0)
  assert.deepEqual(data.actuals['2026-06'], {})
})

test('history spans first known month to now, capped at the limit', () => {
  const data = { ...emptyData(), expenses: [monthly('2026-09-01')] }
  assert.deepEqual(
    history(data, '2026-11').map((m) => m.ym),
    ['2026-09', '2026-10', '2026-11'],
  )
  assert.equal(history({ ...data, expenses: [monthly('2020-01-01')] }, '2026-11').length, 12)
  assert.deepEqual(history(emptyData(), '2026-11'), [])
})

test('new budgets start with the default categories', () => {
  assert.deepEqual(
    emptyData().categories.map((c) => c.name),
    ['Groceries', 'Education', 'Eat out'],
  )
})

test('an expense can be in several categories, and toggling removes one', () => {
  let data = { ...emptyData(), expenses: [monthly()] } // Saved before categories existed.
  data = toggleExpenseCategory(data, 'm', 'groceries')
  data = toggleExpenseCategory(data, 'm', 'eat-out')
  assert.deepEqual(data.expenses[0].categoryIds, ['groceries', 'eat-out'])
  data = toggleExpenseCategory(data, 'm', 'groceries')
  assert.deepEqual(data.expenses[0].categoryIds, ['eat-out'])
})

test('removing a category takes it off expenses and leaves other categories', () => {
  let data = addCategory({ ...emptyData(), expenses: [monthly()] }, 'Fun', 'fun')
  data = toggleExpenseCategory(data, 'm', 'fun')
  data = toggleExpenseCategory(data, 'm', 'education')
  data = removeCategory(data, 'fun')
  assert.equal(
    data.categories.some((c) => c.id === 'fun'),
    false,
  )
  assert.deepEqual(data.expenses[0].categoryIds, ['education'])
})

test('renaming a category keeps it on its expenses and leaves others alone', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = toggleExpenseCategory(data, 'm', 'eat-out')
  data = renameCategory(data, 'eat-out', 'Restaurants')
  assert.deepEqual(
    data.categories.map((c) => c.name),
    ['Groceries', 'Education', 'Restaurants'],
  )
  assert.deepEqual(data.expenses[0].categoryIds, ['eat-out'])
})

test('editing an expense keeps the chosen categories', () => {
  let data = { ...emptyData(), expenses: [monthly()] }
  data = updateExpense(
    data,
    'm',
    { name: 'Rent', amount: 100, startDate: '2026-01-15', categoryIds: ['education'] },
    '2026-06',
  )
  assert.deepEqual(data.expenses[0].categoryIds, ['education'])
})

test('analysis filters by any selected category and counts each expense once', () => {
  const rent = { ...monthly(), categoryIds: ['a', 'b'] }
  const daycare = { ...biweekly(), categoryIds: ['b'] }
  const gym = { ...monthly('2026-01-01', 30), id: 'g', name: 'Gym' }
  const data = { ...emptyData(), expenses: [gym, rent, daycare] }

  const all = analyzeExpenses(data, [], '2026-02')
  assert.equal(all.rows.length, 3)
  assert.equal(all.total, 238.33)
  assert.equal(all.overall, 238.33)

  const both = analyzeExpenses(data, ['a', 'b'], '2026-02')
  assert.deepEqual(
    both.rows.map((r) => r.expense.name),
    ['Daycare', 'Rent'],
  )
  assert.equal(both.total, 208.33)
  assert.equal(both.perYear, 2500)
  assert.equal(both.overall, 238.33)
  assert.equal(both.biggest.expense.name, 'Daycare')
})

test('the uncategorized filter finds expenses with no categories', () => {
  const rent = { ...monthly(), categoryIds: ['a'] }
  const gym = { ...monthly('2026-01-01', 30), id: 'g', name: 'Gym' }
  const data = { ...emptyData(), expenses: [rent, gym] }
  const names = (ids) => analyzeExpenses(data, ids, '2026-02').rows.map((r) => r.expense.name)
  assert.deepEqual(names([UNCATEGORIZED]), ['Gym'])
  assert.deepEqual(names([UNCATEGORIZED, 'a']), ['Rent', 'Gym'])
})

test('analysis skips stopped expenses and reports this month for the filter', () => {
  const rent = { ...monthly(), categoryIds: ['a'] }
  const gym = { ...monthly('2026-01-01', 30), id: 'g', name: 'Gym', categoryIds: ['b'] }
  const old = { ...monthly('2026-01-01', 500), id: 'o', name: 'Old', endMonth: '2026-01' }
  let data = { ...emptyData(), expenses: [rent, gym, old] }
  data = setActual(data, '2026-02', 'm', 120)
  data = setActual(data, '2026-02', 'g', 10)

  const result = analyzeExpenses(data, ['a'], '2026-02')
  assert.equal(result.overall, 130)
  assert.deepEqual(result.month, { planned: 100, actual: 120, difference: -20, entered: 1 })
})

test('analysis handles a filter that matches nothing', () => {
  const result = analyzeExpenses({ ...emptyData(), expenses: [monthly()] }, ['nope'], '2026-02')
  assert.equal(result.rows.length, 0)
  assert.equal(result.total, 0)
  assert.equal(result.biggest, null)
})

test('income follows its schedule, so a three-payment month leaves more', () => {
  let data = { ...emptyData(), expenses: [monthly('2026-01-15', 1000)] }
  data = addIncome(
    data,
    { name: 'Pay', amount: 800, frequency: 'biweekly', startDate: '2026-01-02' },
    'p',
  )
  const january = monthSummary(data, '2026-01')
  assert.equal(january.income, 2400)
  assert.equal(january.incomePayments, 3)
  assert.equal(january.leftOver, 1400)
  assert.equal(monthSummary(data, '2026-02').leftOver, 600)
})

test('left over uses actuals where entered and the plan for the rest', () => {
  let data = { ...emptyData(), expenses: [monthly('2026-01-15', 100), biweekly('2026-01-02', 50)] }
  data = addIncome(
    data,
    { name: 'Pay', amount: 1000, frequency: 'monthly', startDate: '2026-01-01' },
    'p',
  )
  assert.equal(monthSummary(data, '2026-01').leftOver, 750)
  data = setActual(data, '2026-01', 'm', 130)
  data = addExtra(data, '2026-01', { name: 'Tire', amount: 20 }, 'x')
  assert.equal(monthSummary(data, '2026-01').leftOver, 700)
})

test('a month with no income has nothing paid and a negative left over', () => {
  const summary = monthSummary({ ...emptyData(), expenses: [monthly()] }, '2026-01')
  assert.equal(summary.incomePayments, 0)
  assert.equal(summary.leftOver, -100)
})

test('changing income keeps earlier months at the old amount', () => {
  let data = addIncome(
    emptyData(),
    { name: 'Pay', amount: 1000, frequency: 'monthly', startDate: '2026-01-01' },
    'p',
  )
  data = updateIncome(data, 'p', { name: 'Pay', amount: 1200, startDate: '2026-01-01' }, '2026-06')
  assert.equal(monthSummary(data, '2026-05').income, 1000)
  assert.equal(monthSummary(data, '2026-06').income, 1200)
})

test('removing older income keeps this month; new income is deleted outright', () => {
  let data = addIncome(
    emptyData(),
    { name: 'Pay', amount: 1000, frequency: 'monthly', startDate: '2026-01-01' },
    'p',
  )
  data = removeIncome(data, 'p', '2026-06')
  assert.equal(monthSummary(data, '2026-06').income, 1000)
  assert.equal(monthSummary(data, '2026-07').income, 0)

  data = addIncome(
    data,
    { name: 'Side', amount: 50, frequency: 'monthly', startDate: '2026-06-10' },
    's',
  )
  data = removeIncome(data, 's', '2026-06')
  assert.deepEqual(
    data.incomes.map((i) => i.id),
    ['p'],
  )
})

test('marking due as planned skips entered rows and payments still to come', () => {
  const later = { ...monthly('2026-01-25', 40), id: 'l', name: 'Later' }
  let data = { ...emptyData(), expenses: [monthly('2026-01-15', 100), biweekly('2026-01-02', 50), later] }
  data = setActual(data, '2026-02', 'b', 90)

  data = markDueAsPlanned(data, '2026-02', '2026-02-20')
  assert.deepEqual(data.actuals['2026-02'], { b: 90, m: 100 })
})

test('a bi-weekly row is due only after its last payment in the month', () => {
  const data = { ...emptyData(), expenses: [biweekly('2026-01-02', 50)] }
  assert.equal(markDueAsPlanned(data, '2026-02', '2026-02-20').actuals['2026-02'], undefined)
  assert.deepEqual(markDueAsPlanned(data, '2026-02', '2026-02-27').actuals['2026-02'], { b: 100 })
})

test('past months are fully due and future months have nothing due', () => {
  const data = { ...emptyData(), expenses: [monthly('2026-01-15', 100)] }
  assert.deepEqual(markDueAsPlanned(data, '2026-01', '2026-03-01').actuals['2026-01'], { m: 100 })
  assert.equal(markDueAsPlanned(data, '2026-04', '2026-03-01').actuals['2026-04'], undefined)
})
