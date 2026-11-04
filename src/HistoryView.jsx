import {
  currentYm,
  differenceLabel,
  history,
  money,
  monthLabel,
  shortMonth,
  wholeMoney,
} from './budget.js'

/** Rounds up to a clean axis value that leaves headroom for tip labels. */
function axisMax(largest) {
  const target = Math.max(largest * 1.2, 1)
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= target)
  return step * magnitude
}

function Column({ month, scale, labeled, edge, onOpen }) {
  const { ym, difference, hasEntries, planned, actual } = month
  const height = `${(Math.abs(difference) / scale) * 100}%`
  const tip = labeled && <span className="bar-label">{wholeMoney(Math.abs(difference))}</span>

  return (
    <button
      className="chart-col"
      aria-label={`${monthLabel(ym)}: ${hasEntries ? differenceLabel(difference) : 'no entries'}`}
      onClick={() => onOpen(ym)}
    >
      <span className="chart-plot">
        <span className="half up">
          {hasEntries && difference > 0 && (
            <>
              {tip}
              <span className="bar under-fill" style={{ height }} />
            </>
          )}
        </span>
        <span className="half down">
          {hasEntries && difference < 0 && (
            <>
              <span className="bar over-fill" style={{ height }} />
              {tip}
            </>
          )}
        </span>
      </span>
      <span className="chart-x">{shortMonth(ym)}</span>
      <span className={`tooltip ${edge}`}>
        <strong>{hasEntries ? differenceLabel(difference) : 'No entries'}</strong>
        <span>{monthLabel(ym)}</span>
        {hasEntries && (
          <span>
            {money(actual)} of {money(planned)}
          </span>
        )}
      </span>
    </button>
  )
}

function DifferenceChart({ months, onOpen }) {
  const entered = months.filter((m) => m.hasEntries)
  const scale = axisMax(Math.max(...entered.map((m) => Math.abs(m.difference))))
  const mostUnder = entered.reduce((best, m) => (m.difference > (best?.difference ?? 0) ? m : best), null)
  const mostOver = entered.reduce((best, m) => (m.difference < (best?.difference ?? 0) ? m : best), null)

  const edgeFor = (index) => {
    if (index < 2) return 'left'
    return index >= months.length - 2 ? 'right' : ''
  }

  return (
    <>
      <div className="legend">
        <span>
          <i className="swatch under-fill" /> Under budget
        </span>
        <span>
          <i className="swatch over-fill" /> Over budget
        </span>
      </div>
      <div className="chart">
        <div className="chart-axis" aria-hidden="true">
          <span>{wholeMoney(scale)}</span>
          <span>$0</span>
          <span>{wholeMoney(scale)}</span>
        </div>
        <div className="chart-cols">
          {months.map((month, index) => (
            <Column
              key={month.ym}
              month={month}
              scale={scale}
              labeled={month === mostUnder || month === mostOver}
              edge={edgeFor(index)}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </>
  )
}

export default function HistoryView({ data, onOpenMonth }) {
  const months = history(data, currentYm())
  const entered = months.filter((m) => m.hasEntries)
  const total = entered.reduce((sum, m) => sum + m.difference, 0)

  return (
    <>
      <h2>History</h2>
      {entered.length === 0 ? (
        <section className="card empty">
          <p>Enter actual spending on the Month page and your months will show up here.</p>
        </section>
      ) : (
        <>
          <section className="card">
            <h3>Difference by month</h3>
            <DifferenceChart months={months} onOpen={onOpenMonth} />
          </section>
          <section className="card">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Planned</th>
                  <th className="num">Actual</th>
                  <th className="num">Difference</th>
                </tr>
              </thead>
              <tbody>
                {[...months].reverse().map((m) => (
                  <tr key={m.ym}>
                    <td>
                      <button className="link" onClick={() => onOpenMonth(m.ym)}>
                        {monthLabel(m.ym)}
                      </button>
                    </td>
                    <td className="num">{money(m.planned)}</td>
                    <td className="num">{m.hasEntries ? money(m.actual) : '—'}</td>
                    <td className="num">
                      {m.hasEntries ? (
                        <span className={m.difference > 0 ? 'under' : m.difference < 0 ? 'over' : ''}>
                          {differenceLabel(m.difference)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">Total for these months</td>
                  <td className="num">{differenceLabel(Math.round(total * 100) / 100)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}
    </>
  )
}
