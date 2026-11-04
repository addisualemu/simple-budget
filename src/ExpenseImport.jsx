import { useRef, useState } from 'react'
import { addExpense, money, shortDate, todayStr } from './budget.js'
import { validateExpenseCsv } from './csvImport.js'

const SAMPLE = `name,amount,frequency,start date
Rent,1200,monthly,2026-11-01
Daycare,300,bi-weekly,2026-11-06`

const plural = (count) => `${count} expense${count === 1 ? '' : 's'}`

function Preview({ rows }) {
  return (
    <table className="import-preview">
      <thead>
        <tr>
          <th>Line</th>
          <th>Expense</th>
          <th className="num">Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.line}>
            <td className="muted">{row.line}</td>
            <td>
              <div>{row.name || '—'}</div>
              {row.errors.length === 0 && (
                <div className="sub">
                  {row.frequency === 'monthly' ? 'Monthly' : 'Bi-weekly'} from{' '}
                  {shortDate(row.startDate)}, {row.startDate.slice(0, 4)}
                </div>
              )}
            </td>
            <td className="num">{row.amount === null ? '—' : money(row.amount)}</td>
            <td>
              {row.errors.length === 0
                ? 'Ready'
                : row.errors.map((error) => (
                    <div key={error} className="over">
                      {error}
                    </div>
                  ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function ExpenseImport({ names, setData }) {
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState(null)
  const [imported, setImported] = useState(null)
  const fileInput = useRef(null)

  const result = text.trim() ? validateExpenseCsv(text, names, todayStr()) : null
  const rows = result?.rows ?? []
  const ready = rows.filter((row) => row.errors.length === 0)
  const skipped = rows.length - ready.length

  const changeText = (value) => {
    setText(value)
    setFileError(null)
    setImported(null)
  }

  const readFile = async (file) => {
    if (!file) return
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setFileError(`${file.name} is not a CSV file.`)
      return
    }
    changeText(await file.text())
  }

  const drop = (event) => {
    event.preventDefault()
    setDragging(false)
    readFile(event.dataTransfer.files[0])
  }

  const runImport = () => {
    setData((data) =>
      ready.reduce(
        (next, { name, amount, frequency, startDate }) =>
          addExpense(next, { name, amount, frequency, startDate }),
        data,
      ),
    )
    setText('')
    setImported(ready.length)
  }

  return (
    <section className="card">
      <h3>Import expenses from CSV</h3>
      <p className="sub">
        Needs a header row with name, amount and frequency (monthly or bi-weekly). A start date
        column is optional, and blank dates use today.
      </p>

      <textarea
        aria-label="CSV data"
        className={dragging ? 'csv-input dragging' : 'csv-input'}
        rows="5"
        spellCheck="false"
        placeholder={`Drop a .csv file here or paste its text:\n\n${SAMPLE}`}
        value={text}
        onChange={(e) => changeText(e.target.value)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      />

      <div className="form-actions import-actions">
        <button className="link" onClick={() => fileInput.current.click()}>
          Choose a file
        </button>
        {text && (
          <button className="link" onClick={() => changeText('')}>
            Clear
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt"
          hidden
          onChange={(e) => {
            readFile(e.target.files[0])
            e.target.value = ''
          }}
        />
      </div>

      {(fileError || result?.error) && (
        <p className="over import-message" role="alert">
          {fileError ?? result.error}
        </p>
      )}
      {imported !== null && (
        <p className="import-message" role="status">
          Imported {plural(imported)}.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <Preview rows={rows} />
          <div className="form-actions import-actions">
            <button className="button" onClick={runImport} disabled={ready.length === 0}>
              Import {plural(ready.length)}
            </button>
            {skipped > 0 && (
              <span className="sub">
                {skipped} {skipped === 1 ? 'row has' : 'rows have'} problems and will be skipped.
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
