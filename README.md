# Budget

A personal budget tracker. Set known monthly and bi-weekly expenses, enter what you
actually spent, and see the difference each month.

```bash
cp .env.example .env   # then fill in the Firebase web config
npm install
npm run dev
```

Then open http://localhost:5173. Run the logic tests with `npm test`.

- **Month**: planned vs actual for one month. Bi-weekly expenses count the real number
  of payments that land in that month (2 or 3).
- **Expenses**: your known expenses, plus backup export and import.
- **History**: the difference for the last 12 months.

Data is stored in Firestore as one document, `budgets/main`, in the Firebase project
`budget-ac996`. Deploy the site and database rules with `npm run deploy`. Budget rules live in
`src/budget.js`. To change the currency, edit the formatters at the bottom of that file.
