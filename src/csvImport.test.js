import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCsv, validateExpenseCsv } from './csvImport.js'

const TODAY = '2026-11-04'
const validate = (text, existing = []) => validateExpenseCsv(text, existing, TODAY)
const errorsOf = (text, existing) => validate(text, existing).rows[0].errors

test('parseCsv handles quotes, escaped quotes, CRLF and blank lines', () => {
  const records = parseCsv('a,"b,c"\r\n\r\n"say ""hi""",2\r\n')
  assert.deepEqual(records, [
    { line: 1, cells: ['a', 'b,c'] },
    { line: 3, cells: ['say "hi"', '2'] },
  ])
})

test('valid rows parse, with flexible headers, amounts, frequencies and dates', () => {
  const { rows } = validate(
    '﻿Expense,Amount,How often,First payment date\n' +
      'Rent,"$1,200.50",Monthly,11/1/2026\n' +
      'Daycare,300,bi-weekly,2026-11-06\n' +
      'Gym,0,Every 2 weeks,\n',
  )
  assert.deepEqual(
    rows.map(({ name, amount, frequency, startDate, errors }) => [
      name,
      amount,
      frequency,
      startDate,
      errors.length,
    ]),
    [
      ['Rent', 1200.5, 'monthly', '2026-11-01', 0],
      ['Daycare', 300, 'biweekly', '2026-11-06', 0],
      ['Gym', 0, 'biweekly', TODAY, 0],
    ],
  )
})

test('the date column is optional', () => {
  const { rows } = validate('name,amount,frequency\nRent,100,monthly')
  assert.equal(rows[0].startDate, TODAY)
  assert.deepEqual(rows[0].errors, [])
})

test('tab-separated text pasted from a spreadsheet works', () => {
  const { rows } = validate('name\tamount\tfrequency\nRent\t1,200\tmonthly')
  assert.equal(rows[0].amount, 1200)
  assert.deepEqual(rows[0].errors, [])
})

test('unreadable input gives a file-level error', () => {
  assert.match(validate('  \n').error, /nothing to import/)
  assert.match(validate('Rent,100,monthly\n').error, /Missing: name, amount, frequency/)
  assert.match(validate('name,amount\nRent,100').error, /Missing: frequency/)
  assert.match(validate('name,amount,frequency\n').error, /no expenses/)
})

test('bad values are reported per row', () => {
  const header = 'name,amount,frequency,date\n'
  assert.match(errorsOf(`${header},100,monthly,2026-11-01`)[0], /Name is missing/)
  assert.match(errorsOf(`${header}Rent,abc,monthly,2026-11-01`)[0], /not a valid amount/)
  assert.match(errorsOf(`${header}Rent,-5,monthly,2026-11-01`)[0], /not a valid amount/)
  assert.match(errorsOf(`${header}Rent,1.234,monthly,2026-11-01`)[0], /not a valid amount/)
  assert.match(errorsOf(`${header}Rent,100,weekly,2026-11-01`)[0], /monthly or bi-weekly/)
  assert.match(errorsOf(`${header}Rent,100,monthly,2026-02-30`)[0], /real date/)
  assert.match(errorsOf(`${header}Rent,100,monthly,soon`)[0], /real date/)
})

test('an unquoted amount with a comma is caught, not misread', () => {
  const errors = errorsOf('name,amount,frequency,date\nRent,1,200,monthly,2026-11-01')
  assert.match(errors[0], /Has 5 columns, expected 4/)
})

test('one row can report several problems, and good rows stay good', () => {
  const { rows } = validate('name,amount,frequency\nRent,x,weekly\nGym,30,monthly')
  assert.equal(rows[0].errors.length, 2)
  assert.deepEqual(rows[1].errors, [])
})

test('duplicates are caught against saved expenses and within the file', () => {
  const { rows } = validate('name,amount,frequency\nrent,100,monthly\nGym,30,monthly\nGYM,30,monthly', [
    'Rent',
  ])
  assert.match(rows[0].errors[0], /already exists/)
  assert.deepEqual(rows[1].errors, [])
  assert.match(rows[2].errors[0], /already exists/)
})

test('rows keep their real file line numbers', () => {
  const { rows } = validate('name,amount,frequency\n\nRent,100,monthly')
  assert.equal(rows[0].line, 3)
})
