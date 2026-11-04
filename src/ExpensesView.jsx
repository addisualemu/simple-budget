import { useRef, useState } from 'react'
import {
  addExpense,
  averagePerMonth,
  currentYm,
  isValidData,
  latestAmount,
  money,
  removeExpense,
  shortDate,
  todayStr,
  updateExpense,
} from './budget.js'

const blankForm = () => ({ name: '', amount: '', frequency: 'monthly', startDate: todayStr() })

function scheduleText(expense) {
  if (expense.frequency === 'monthly') {
    return `Monthly on day ${Number(expense.startDate.slice(8, 10))}`
  }
  return `Every 2 weeks from ${shortDate(expense.startDate)}, ${expense.startDate.slice(0, 4)}`
}

function ExpenseForm({ editing, onSave, onCancel }) {
  const [form, setForm] = useState(
    editing
      ? {
          name: editing.name,
          amount: String(latestAmount(editing)),
          frequency: editing.frequency,
          startDate: editing.startDate,
        }
      : blankForm(),
  )
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  const submit = (event) => {
    event.preventDefault()
    onSave({ ...form, name: form.name.trim(), amount: Number(form.amount) })
    if (!editing) setForm({ ...blankForm(), frequency: form.frequency })
  }

  const startedEarlier = editing && editing.startDate.slice(0, 7) < currentYm()

  return (
    <form className="expense-form" onSubmit={submit}>
      <label>
        Name
        <input value={form.name} onChange={set('name')} placeholder="Rent" required />
      </label>
      <label>
        How often
        <select value={form.frequency} onChange={set('frequency')} disabled={!!editing}>
          <option value="monthly">Monthly</option>
          <option value="biweekly">Bi-weekly</option>
        </select>
      </label>
      <label>
        Amount per payment
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={form.amount}
          onChange={set('amount')}
          required
        />
      </label>
      <label>
        First payment date
        <input type="date" value={form.startDate} onChange={set('startDate')} required />
      </label>
      <div className="form-actions">
        <button className="button">{editing ? 'Save changes' : 'Add expense'}</button>
        {editing && (
          <button type="button" className="link" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {startedEarlier && (
        <p className="sub form-note">
          A new amount applies from this month on. Earlier months keep the old amount.
        </p>
      )}
    </form>
  )
}

function Backup({ data, setData }) {
  const fileInput = useRef(null)

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `budget-backup-${todayStr()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    let imported = null
    try {
      imported = JSON.parse(await file.text())
    } catch {
      // Handled by the validity check below.
    }
    if (!isValidData(imported)) {
      window.alert('That file is not a budget backup.')
      return
    }
    if (window.confirm('Replace everything in this budget with the backup?')) setData(imported)
  }

  return (
    <section className="card">
      <h3>Backup</h3>
      <p className="sub">
        Your budget is saved online in Firebase. Export a copy now and then to keep your own backup.
      </p>
      <div className="form-actions">
        <button className="button secondary" onClick={exportData}>
          Export
        </button>
        <button className="button secondary" onClick={() => fileInput.current.click()}>
          Import
        </button>
        <input ref={fileInput} type="file" accept=".json" hidden onChange={importData} />
      </div>
    </section>
  )
}

export default function ExpensesView({ data, setData }) {
  const [editingId, setEditingId] = useState(null)
  const nowYm = currentYm()

  const expenses = data.expenses
    .filter((e) => !e.endMonth)
    .sort((a, b) => a.frequency.localeCompare(b.frequency) * -1 || a.name.localeCompare(b.name))
  const editing = expenses.find((e) => e.id === editingId)
  const average = expenses.reduce((sum, e) => sum + averagePerMonth(e), 0)

  const save = (fields) => {
    if (editing) {
      setData((d) => updateExpense(d, editing.id, fields, nowYm))
      setEditingId(null)
    } else {
      setData((d) => addExpense(d, fields))
    }
  }

  const remove = (expense) => {
    if (!window.confirm(`Remove ${expense.name}? Earlier months keep their numbers.`)) return
    setData((d) => removeExpense(d, expense.id, nowYm))
    if (editingId === expense.id) setEditingId(null)
  }

  return (
    <>
      <h2>Known expenses</h2>
      <section className="card">
        <h3>{editing ? `Edit ${editing.name}` : 'Add an expense'}</h3>
        <ExpenseForm
          key={editingId ?? 'new'}
          editing={editing}
          onSave={save}
          onCancel={() => setEditingId(null)}
        />
      </section>

      {expenses.length > 0 && (
        <section className="card">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th className="num">Per payment</th>
                <th className="num actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>
                    <div>{expense.name}</div>
                    <div className="sub">{scheduleText(expense)}</div>
                  </td>
                  <td className="num">{money(latestAmount(expense))}</td>
                  <td className="num actions">
                    <button className="link small" onClick={() => setEditingId(expense.id)}>
                      Edit
                    </button>
                    <button className="link small" onClick={() => remove(expense)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Average per month</td>
                <td className="num">{money(average)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p className="sub">
            Bi-weekly expenses average 26 payments a year. The Month page uses the real number of
            payments in each month.
          </p>
        </section>
      )}

      <Backup data={data} setData={setData} />
    </>
  )
}
