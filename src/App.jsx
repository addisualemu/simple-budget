import { useState } from 'react'
import AnalysisView from './AnalysisView.jsx'
import { currentYm } from './budget.js'
import ExpensesView from './ExpensesView.jsx'
import HistoryView from './HistoryView.jsx'
import IncomeView from './IncomeView.jsx'
import MonthView from './MonthView.jsx'
import SignIn from './SignIn.jsx'
import { signOutUser, useAuth } from './useAuth.js'
import { useBudgetData } from './useBudgetData.js'

const TABS = ['Month', 'Expenses', 'Income', 'Analysis', 'History']

const SAVE_LABELS = { saving: 'Saving…', saved: 'Saved', error: 'Not saved' }

const LOAD_MESSAGES = {
  error: 'Could not reach the database.',
  denied: 'This Google account does not have access to this budget.',
}

function Budget() {
  const { data, setData, status, flush } = useBudgetData()
  const [tab, setTab] = useState('Month')
  const [ym, setYm] = useState(currentYm)

  const openMonth = (month) => {
    setYm(month)
    setTab('Month')
  }

  const leave = async () => {
    await flush()
    await signOutUser()
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Budget</h1>
        <span className={status === 'error' ? 'save-status over' : 'save-status'} role="status">
          {SAVE_LABELS[status]}
        </span>
        <button className="link small" onClick={leave}>
          Sign out
        </button>
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
          {LOAD_MESSAGES[status] ?? 'Loading…'}
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
              onAddIncome={() => setTab('Income')}
            />
          )}
          {tab === 'Expenses' && <ExpensesView data={data} setData={setData} />}
          {tab === 'Income' && <IncomeView data={data} setData={setData} />}
          {tab === 'Analysis' && <AnalysisView data={data} />}
          {tab === 'History' && <HistoryView data={data} onOpenMonth={openMonth} />}
        </main>
      )}
    </div>
  )
}

export default function App() {
  const user = useAuth()
  if (user === undefined) return <main className="app card empty">Loading…</main>
  return user ? <Budget /> : <SignIn />
}
