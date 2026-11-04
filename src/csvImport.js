// Parses and validates CSV text of known expenses. Nothing here touches saved data.

const HEADERS = {
  name: ['name', 'expense'],
  amount: ['amount', 'amount per payment'],
  frequency: ['frequency', 'how often'],
  startDate: ['start date', 'startdate', 'date', 'first payment', 'first payment date'],
}

const FREQUENCIES = {
  monthly: 'monthly',
  biweekly: 'biweekly',
  'bi-weekly': 'biweekly',
  'bi weekly': 'biweekly',
  'every 2 weeks': 'biweekly',
}

const pad = (n) => String(n).padStart(2, '0')

/** Splits text into records of { line, cells }, honoring quoted fields. */
export function parseCsv(text, delimiter = ',') {
  const records = []
  let cells = []
  let cell = ''
  let quoted = false
  let line = 1
  let recordLine = 1

  const endCell = () => {
    cells.push(cell.trim())
    cell = ''
  }
  const endRecord = () => {
    endCell()
    while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
    if (cells.length > 0) records.push({ line: recordLine, cells })
    cells = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\n') line++
    if (quoted) {
      if (char !== '"') cell += char
      else if (text[i + 1] === '"') cell += text[++i]
      else quoted = false
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      endCell()
    } else if (char === '\n') {
      endRecord()
      recordLine = line
    } else if (char !== '\r') {
      cell += char
    }
  }
  endRecord()
  return records
}

function parseAmount(text) {
  const plain = /^\$?\d+(\.\d{1,2})?$/
  const grouped = /^\$?\d{1,3}(,\d{3})+(\.\d{1,2})?$/
  if (!plain.test(text) && !grouped.test(text)) return null
  return Number(text.replace(/[$,]/g, ''))
}

/** Accepts YYYY-MM-DD or M/D/YYYY and returns YYYY-MM-DD, or null if not a real date. */
function parseDate(text) {
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!iso && !us) return null
  const [year, month, day] = (iso ? iso.slice(1) : [us[3], us[1], us[2]]).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function headerColumns(cells) {
  const columns = {}
  cells.forEach((cell, index) => {
    const label = cell.toLowerCase()
    const field = Object.keys(HEADERS).find((key) => HEADERS[key].includes(label))
    if (field) columns[field] = index
  })
  return columns
}

/**
 * Returns { error } if the text can't be read at all, otherwise { rows } where each
 * row has its parsed fields and `errors`. Rows with no errors are safe to import.
 * A blank start date uses `today`.
 */
export function validateExpenseCsv(text, existingNames, today) {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split('\n', 1)[0]
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ','
  const [header, ...records] = parseCsv(clean, delimiter)

  if (!header) return { error: 'There is nothing to import.' }

  const columns = headerColumns(header.cells)
  const missing = ['name', 'amount', 'frequency'].filter((field) => columns[field] === undefined)
  if (missing.length > 0) {
    return { error: `The first line must be a header row. Missing: ${missing.join(', ')}.` }
  }
  if (records.length === 0) return { error: 'The header is there, but no expenses follow it.' }

  const seen = new Set(existingNames.map((name) => name.toLowerCase()))

  const rows = records.map(({ line, cells }) => {
    const value = (field) => cells[columns[field]] ?? ''
    const errors = []

    if (cells.length > header.cells.length) {
      errors.push(
        `Has ${cells.length} columns, expected ${header.cells.length}. Put quotes around amounts with commas.`,
      )
    }

    const name = value('name')
    if (!name) errors.push('Name is missing.')
    else if (seen.has(name.toLowerCase())) errors.push('An expense with this name already exists.')
    seen.add(name.toLowerCase())

    const amount = parseAmount(value('amount'))
    if (amount === null) errors.push(`Amount "${value('amount')}" is not a valid amount.`)

    const frequency = FREQUENCIES[value('frequency').toLowerCase()]
    if (!frequency) errors.push(`Frequency "${value('frequency')}" must be monthly or bi-weekly.`)

    const dateText = columns.startDate === undefined ? '' : value('startDate')
    const startDate = dateText ? parseDate(dateText) : today
    if (!startDate) errors.push(`Date "${dateText}" must be a real date like 2026-11-01 or 11/1/2026.`)

    return { line, name, amount, frequency, startDate, errors }
  })

  return { rows }
}
