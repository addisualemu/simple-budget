import { useState } from 'react'
import {
  addExtra,
  addMonths,
  currentYm,
  differenceLabel,
  money,
  monthLabel,
  monthSummary,
  removeExtra,
  setActual,
  shortDate,
} from './budget.js'

const differenceClass = (n) => (n > 0 ? 'under' : n < 0 ? 'over' : '')

function schedule({ expense, dates }) {
  const when = dates.map(shortDate).join(', ')
  return expense.frequency === 'monthly' ? `Monthly · ${when}` : `Bi-weekly ×${dates.length} · ${when}`
}

function Difference({ value }) {
  if (value === null) return <span className="muted">—</span>
  return <span className={differenceClass(value)}>{differenceLabel(value)}</span>
}

function LeftOver({ summary, onAddIncome }) {
  const { rows, enteredCount, income, incomePayments, leftOver } = summary
  if (incomePayments === 0) {
    return (
      <section className="card empty">
        <p>Add your income to see what is left over each month.</p>
        <button className="button" onClick={onAddIncome}>
          Add income
        </button>
      </section>
    )
  }
  return (
    <section className="tiles pair">
      <div className="tile">
        <span className="tile-label">Income</span>
        <span className="tile-value">{money(income)}</span>
        <span className="tile-note">
          {incomePayments} payment{incomePayments === 1 ? '' : 's'} this month
        </span>
      </div>
      <div className="tile">
        <span className="tile-label">Left over</span>
        <span className={`tile-value ${differenceClass(leftOver)}`}>{money(leftOver)}</span>
        {enteredCount < rows.length && (
          <span className="tile-note">If the rest goes as planned</span>
        )}
      </div>
    </section>
  )
}

function Totals({ summary }) {
  const { rows, planned, actual, difference, enteredCount, hasEntries } = summary
  const missing = rows.length - enteredCount
  return (
    <section className="tiles">
      <div className="tile">
        <span className="tile-label">Planned</span>
        <span className="tile-value">{money(planned)}</span>
      </div>
      <div className="tile">
        <span className="tile-label">Actual</span>
        <span className="tile-value">{money(actual)}</span>
      </div>
      <div className="tile">
        <span className="tile-label">Difference</span>
        <span className={`tile-value ${differenceClass(difference)}`}>
          {hasEntries ? differenceLabel(difference) : '—'}
        </span>
        {missing > 0 && (
          <span className="tile-note">
            {hasEntries ? 'So far · ' : ''}
            {missing} of {rows.length} not entered
          </span>
        )}
      </div>
    </section>
  )
}

function ExtraForm({ onAdd }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const submit = (event) => {
    event.preventDefault()
    onAdd({ name: name.trim(), amount: Number(amount) })
    setName('')
    setAmount('')
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        aria-label="Unplanned expense name"
        placeholder="What was it?"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        aria-label="Unplanned expense amount"
        className="amount"
        type="number"
        step="0.01"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <button className="button">Add</button>
    </form>
  )
}

export default function MonthView({ data, setData, ym, setYm, onSetUp, onAddIncome }) {
  const summary = monthSummary(data, ym)
  const today = currentYm()

  const enterActual = (id, text) =>
    setData((d) => setActual(d, ym, id, text === '' ? null : Number(text)))

  return (
    <>
      <div className="month-nav">
        <button className="icon-button" aria-label="Previous month" onClick={() => setYm(addMonths(ym, -1))}>
          ‹
        </button>
        <h2>{monthLabel(ym)}</h2>
        <button className="icon-button" aria-label="Next month" onClick={() => setYm(addMonths(ym, 1))}>
          ›
        </button>
        {ym !== today && (
          <button className="link" onClick={() => setYm(today)}>
            This month
          </button>
        )}
      </div>

      <Totals summary={summary} />
      <LeftOver summary={summary} onAddIncome={onAddIncome} />

      {summary.rows.length === 0 ? (
        <section className="card empty">
          {data.expenses.length === 0 ? (
            <>
              <p>Add your known monthly and bi-weekly expenses to get started.</p>
              <button className="button" onClick={onSetUp}>
                Set up expenses
              </button>
            </>
          ) : (
            <p>No planned expenses fall in this month.</p>
          )}
        </section>
      ) : (
        <section className="card">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th className="num">Planned</th>
                <th className="num">Actual</th>
                <th className="num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.expense.id}>
                  <td>
                    <div>{row.expense.name}</div>
                    <div className="sub">{schedule(row)}</div>
                  </td>
                  <td className="num">{money(row.planned)}</td>
                  <td className="num">
                    <input
                      aria-label={`Actual for ${row.expense.name}`}
                      className="amount"
                      type="number"
                      step="0.01"
                      value={row.actual ?? ''}
                      onChange={(e) => enterActual(row.expense.id, e.target.value)}
                    />
                    {row.actual === null && (
                      <button
                        className="link small"
                        onClick={() => enterActual(row.expense.id, String(row.planned))}
                      >
                        Same as planned
                      </button>
                    )}
                  </td>
                  <td className="num">
                    <Difference value={row.difference} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <h3>Unplanned spending</h3>
        {summary.extras.length > 0 && (
          <table>
            <tbody>
              {summary.extras.map((extra) => (
                <tr key={extra.id}>
                  <td>{extra.name}</td>
                  <td className="num">{money(extra.amount)}</td>
                  <td className="num actions">
                    <button
                      className="link small"
                      onClick={() => setData((d) => removeExtra(d, ym, extra.id))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ExtraForm onAdd={(extra) => setData((d) => addExtra(d, ym, extra))} />
      </section>
    </>
  )
}
