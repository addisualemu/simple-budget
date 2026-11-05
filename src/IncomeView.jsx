import { useState } from 'react'
import {
  activeExpenses,
  addIncome,
  averagePerMonth,
  currentYm,
  latestAmount,
  money,
  removeIncome,
  scheduleText,
  updateIncome,
} from './budget.js'
import { ExpenseForm } from './ExpensesView.jsx'

const averageOf = (items) => items.reduce((sum, item) => sum + averagePerMonth(item), 0)

export default function IncomeView({ data, setData }) {
  const [editingId, setEditingId] = useState(null)
  const nowYm = currentYm()

  const incomes = data.incomes
    .filter((i) => !i.endMonth)
    .sort((a, b) => a.name.localeCompare(b.name))
  const editing = incomes.find((i) => i.id === editingId)
  const average = averageOf(incomes)
  const leftOver = average - averageOf(activeExpenses(data))

  const save = (fields) => {
    if (editing) {
      setData((d) => updateIncome(d, editing.id, fields, nowYm))
      setEditingId(null)
    } else {
      setData((d) => addIncome(d, fields))
    }
  }

  const remove = (income) => {
    if (!window.confirm(`Remove ${income.name}? Earlier months keep their numbers.`)) return
    setData((d) => removeIncome(d, income.id, nowYm))
    if (editingId === income.id) setEditingId(null)
  }

  return (
    <>
      <h2>Income</h2>
      <section className="card">
        <h3>{editing ? `Edit ${editing.name}` : 'Add income'}</h3>
        <ExpenseForm
          key={editingId ?? 'new'}
          editing={editing}
          categories={[]}
          noun="income"
          namePlaceholder="Paycheck"
          onSave={save}
          onCancel={() => setEditingId(null)}
        />
      </section>

      {incomes.length > 0 && (
        <section className="card">
          <table>
            <thead>
              <tr>
                <th>Income</th>
                <th className="num">Per payment</th>
                <th className="num actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {incomes.map((income) => (
                <tr key={income.id}>
                  <td>
                    <div>{income.name}</div>
                    <div className="sub">{scheduleText(income)}</div>
                  </td>
                  <td className="num">{money(latestAmount(income))}</td>
                  <td className="num actions">
                    <button className="link small" onClick={() => setEditingId(income.id)}>
                      Edit
                    </button>
                    <button className="link small" onClick={() => remove(income)}>
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
            After your known expenses, that leaves {money(leftOver)} in an average month. The Month
            page uses the real number of payments in each month.
          </p>
        </section>
      )}
    </>
  )
}
