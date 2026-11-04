import { useState } from 'react'
import { currentYm } from './budget.js'
import ExpensesView from './ExpensesView.jsx'
import HistoryView from './HistoryView.jsx'
import MonthView from './MonthView.jsx'
import { useBudgetData } from './useBudgetData.js'

const TABS = ['Month', 'Expenses', 'History']

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', error: 'Not saved' }

export default function App() {
  const { data, setData, status } = useBudgetData()
  const [tab, setTab] = useState('Month')
  const [ym, setYm] = useState(currentYm)

  const openMonth = (month) => {
    setYm(month)
    setTab('Month')
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Budget</h1>
        <span className={status === 'error' ? 'save-status over' : 'save-status'} role="status">
          {SAVE_LABELS[status]}
        </span>
        <nav>
          {TABS.map((name) => (
            <button
              key={name}
              className={name === tab ? 'tab active' : 'tab'}
              aria-current={name === tab ? 'page' : undefined}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </nav>
      </header>

      {data === null ? (
        <main className="card empty">
          {status === 'error' ? 'Could not reach the database.' : 'Loading…'}
        </main>
      ) : (
        <main>
          {tab === 'Month' && (
            <MonthView
              data={data}
              setData={setData}
              ym={ym}
              setYm={setYm}
              onSetUp={() => setTab('Expenses')}
            />
          )}
          {tab === 'Expenses' && <ExpensesView data={data} setData={setData} />}
          {tab === 'History' && <HistoryView data={data} onOpenMonth={openMonth} />}
        </main>
      )}
    </div>
  )
}
