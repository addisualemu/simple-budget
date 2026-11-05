import { useState } from 'react'
import {
  addMonths,
  analyzeExpenses,
  categoryBreakdown,
  currentYm,
  differenceLabel,
  latestAmount,
  money,
  monthLabel,
  scheduleText,
  toggleCategoryId,
  UNCATEGORIZED,
} from './budget.js'
import CategoryChips from './CategoryChips.jsx'

function Dashboard({ analysis, filtered }) {
  const { rows, total, overall, perYear, biggest, month } = analysis
  const share = overall > 0 ? Math.round((total / overall) * 100) : 0

  return (
    <section className="dashboard">
      <div className="tile hero">
        <span className="tile-label">Total per month</span>
        <span className="hero-value">{money(total)}</span>
        <span className="tile-note">
          {filtered ? `${share}% of your ${money(overall)} total` : 'All known expenses'}
        </span>
      </div>
      <div className="tile">
        <span className="tile-label">Per year</span>
        <span className="tile-value">{money(perYear)}</span>
      </div>
      <div className="tile">
        <span className="tile-label">Expenses</span>
        <span className="tile-value">{rows.length}</span>
      </div>
      <div className="tile">
        <span className="tile-label">Biggest expense</span>
        <span className="tile-value">{biggest ? money(biggest.perMonth) : '—'}</span>
        {biggest && <span className="tile-note">{biggest.expense.name} · per month</span>}
      </div>
      <div className="tile">
        <span className="tile-label">Spent this month</span>
        <span className="tile-value">{money(month.actual)}</span>
        <span className="tile-note">
          of {money(month.planned)} planned
          {month.entered > 0 && ` · ${differenceLabel(month.difference)}`}
        </span>
      </div>
    </section>
  )
}

function PlannedVsActual({ data, selected }) {
  const [ym, setYm] = useState(currentYm)
  const rows = categoryBreakdown(data, ym).filter(
    (row) => selected.length === 0 || selected.includes(row.id),
  )

  return (
    <section className="card">
      <div className="card-head">
        <h3>Planned vs actual</h3>
        <button
          className="icon-button"
          aria-label="Previous month"
          onClick={() => setYm(addMonths(ym, -1))}
        >
          ‹
        </button>
        <span>{monthLabel(ym)}</span>
        <button
          className="icon-button"
          aria-label="Next month"
          onClick={() => setYm(addMonths(ym, 1))}
        >
          ›
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="sub">Nothing planned or spent here this month.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Planned</th>
                <th className="num">Actual</th>
                <th className="num">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="num">{money(row.planned)}</td>
                  <td className="num">{row.entered > 0 ? money(row.actual) : '—'}</td>
                  <td className="num">
                    {row.entered > 0 ? (
                      <span className={row.difference > 0 ? 'under' : row.difference < 0 ? 'over' : ''}>
                        {differenceLabel(row.difference)}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sub">
            Difference only counts what you have entered, plus unplanned spending. Anything in two
            categories counts in both.
          </p>
        </>
      )}
    </section>
  )
}

export default function AnalysisView({ data }) {
  const [selected, setSelected] = useState([])
  const analysis = analyzeExpenses(data, selected, currentYm())
  const filters = [...data.categories, { id: UNCATEGORIZED, name: 'Uncategorized' }]

  return (
    <>
      <h2>Expense analysis</h2>

      <div className="filter-bar">
        <CategoryChips
          categories={filters}
          selected={selected}
          label="Filter by category"
          onToggle={(id) => setSelected((ids) => toggleCategoryId(ids, id))}
        />
        {selected.length > 0 && (
          <button className="link small" onClick={() => setSelected([])}>
            Clear filter
          </button>
        )}
      </div>

      <Dashboard analysis={analysis} filtered={selected.length > 0} />

      <PlannedVsActual data={data} selected={selected} />

      {analysis.rows.length === 0 ? (
        <section className="card empty">
          <p>
            {selected.length > 0
              ? 'No expenses in these categories.'
              : 'Add expenses on the Expenses page to see them here.'}
          </p>
        </section>
      ) : (
        <section className="card">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th>Categories</th>
                <th className="num hide-narrow">Per payment</th>
                <th className="num">Per month</th>
              </tr>
            </thead>
            <tbody>
              {analysis.rows.map(({ expense, perMonth, categoryNames }) => (
                <tr key={expense.id}>
                  <td>
                    <div>{expense.name}</div>
                    <div className="sub">{scheduleText(expense)}</div>
                  </td>
                  <td className="sub">{categoryNames.join(', ') || '—'}</td>
                  <td className="num hide-narrow">{money(latestAmount(expense))}</td>
                  <td className="num">{money(perMonth)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td />
                <td className="hide-narrow" />
                <td className="num">{money(analysis.total)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="sub">
            Per month averages bi-weekly expenses over 26 payments a year. An expense in two selected
            categories counts once.
          </p>
        </section>
      )}
    </>
  )
}
