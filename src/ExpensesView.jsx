import { useRef, useState } from 'react'
import {
  activeExpenses,
  addCategory,
  addExpense,
  averagePerMonth,
  currentYm,
  emptyData,
  isValidData,
  latestAmount,
  money,
  removeCategory,
  removeExpense,
  renameCategory,
  scheduleText,
  todayStr,
  toggleCategoryId,
  toggleExpenseCategory,
  updateExpense,
} from './budget.js'
import CategoryChips from './CategoryChips.jsx'
import ExpenseImport from './ExpenseImport.jsx'

const blankForm = () => ({
  name: '',
  amount: '',
  frequency: 'monthly',
  startDate: todayStr(),
  categoryIds: [],
})

function Categories({ data, setData }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [draft, setDraft] = useState('')
  const cancelled = useRef(false)

  const isTaken = (text, exceptId) => {
    const taken = data.categories.some(
      (c) => c.id !== exceptId && c.name.toLowerCase() === text.toLowerCase(),
    )
    setError(taken ? `${text} already exists.` : null)
    return taken
  }

  const add = (event) => {
    event.preventDefault()
    const clean = name.trim()
    if (isTaken(clean)) return
    setData((d) => addCategory(d, clean))
    setName('')
  }

  const startRename = (category) => {
    cancelled.current = false
    setRenamingId(category.id)
    setDraft(category.name)
    setError(null)
  }

  const stopRename = () => {
    setRenamingId(null)
    setError(null)
  }

  const finishRename = (category) => {
    const clean = draft.trim()
    if (cancelled.current || !clean || clean === category.name) {
      stopRename()
      return
    }
    if (isTaken(clean, category.id)) return
    setData((d) => renameCategory(d, category.id, clean))
    stopRename()
  }

  const remove = (category) => {
    const used = data.expenses.filter((e) => e.categoryIds?.includes(category.id)).length
    const warning = used ? ` It will be taken off ${used} expense${used === 1 ? '' : 's'}.` : ''
    if (!window.confirm(`Remove the ${category.name} category?${warning}`)) return
    setData((d) => removeCategory(d, category.id))
  }

  return (
    <section className="card">
      <h3>Categories</h3>
      {data.categories.length > 0 && <p className="sub">Click a name to rename it.</p>}
      {data.categories.length > 0 && (
        <div className="chips category-list">
          {data.categories.map((category) => (
            <span key={category.id} className="chip static">
              {renamingId === category.id ? (
                <input
                  aria-label={`New name for ${category.name}`}
                  className="chip-input"
                  size={Math.max(draft.length, 4)}
                  autoFocus
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setError(null)
                  }}
                  onBlur={() => finishRename(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename(category)
                    if (e.key === 'Escape') {
                      cancelled.current = true
                      stopRename()
                    }
                  }}
                />
              ) : (
                <button
                  className="chip-name"
                  aria-label={`Rename ${category.name}`}
                  title="Rename"
                  onClick={() => startRename(category)}
                >
                  {category.name}
                </button>
              )}
              <button
                className="chip-remove"
                aria-label={`Remove ${category.name} category`}
                onClick={() => remove(category)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="inline-form" onSubmit={add}>
        <input
          aria-label="New category name"
          placeholder="New category"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          required
        />
        <button className="button">Add</button>
      </form>
      {error && (
        <p className="over import-message" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export function ExpenseForm({
  editing,
  categories,
  onSave,
  onCancel,
  noun = 'expense',
  namePlaceholder = 'Rent',
}) {
  const [form, setForm] = useState(
    editing
      ? {
          name: editing.name,
          amount: String(latestAmount(editing)),
          frequency: editing.frequency,
          startDate: editing.startDate,
          categoryIds: editing.categoryIds ?? [],
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
        <input value={form.name} onChange={set('name')} placeholder={namePlaceholder} required />
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
      {categories.length > 0 && (
        <div className="form-categories">
          <span>Categories</span>
          <CategoryChips
            categories={categories}
            selected={form.categoryIds}
            label="Categories for this expense"
            onToggle={(id) =>
              setForm({ ...form, categoryIds: toggleCategoryId(form.categoryIds, id) })
            }
          />
        </div>
      )}
      <div className="form-actions">
        <button className="button">{editing ? 'Save changes' : `Add ${noun}`}</button>
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
    if (window.confirm('Replace everything in this budget with the backup?')) {
      setData({ ...emptyData(), ...imported })
    }
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

  const expenses = activeExpenses(data).sort((a, b) => a.frequency.localeCompare(b.frequency) * -1 || a.name.localeCompare(b.name))
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
          categories={data.categories}
          onSave={save}
          onCancel={() => setEditingId(null)}
        />
      </section>

      <Categories data={data} setData={setData} />

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
                    <CategoryChips
                      categories={data.categories}
                      selected={expense.categoryIds ?? []}
                      label={`Categories for ${expense.name}`}
                      onToggle={(categoryId) =>
                        setData((d) => toggleExpenseCategory(d, expense.id, categoryId))
                      }
                    />
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

      <ExpenseImport names={expenses.map((e) => e.name)} setData={setData} />

      <Backup data={data} setData={setData} />
    </>
  )
}
