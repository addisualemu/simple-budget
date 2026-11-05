# Budget

A simple budget tracker for one person. Set your known monthly and bi-weekly expenses and income,
enter what you actually spent, and see the difference every month.

It's free to use. There's no shared server or account to sign up for: you run it on your own
Firebase project, so your data stays in your own database. Firebase's free Spark plan should be
plenty for one person's budget.

## Features

- **Month**: planned vs actual for one month, with income and what's left over. Bi-weekly items use
  real payment dates, so a month can have 2 or 3 payments. Mark everything due as planned in one
  click, and add unplanned spending.
- **Expenses**: manage known expenses and categories, import expenses from a CSV file, and export or
  import a full backup. An expense can be in several categories.
- **Income**: manage monthly and bi-weekly income.
- **Analysis**: filter by category, see totals and your biggest expenses, and compare planned vs
  actual per category.
- **History**: the difference for the last 12 months.

Data syncs live between your devices, and only the Google account you choose can open it.

## Set up your own copy

You'll need [Node.js](https://nodejs.org) and a free [Firebase](https://firebase.google.com) account.

### 1. Get the code

Clone this repository, then install its dependencies:

```bash
npm install
```

### 2. Create a Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project.
2. Go to **Firestore Database** and create a database in production mode.
3. Go to **Authentication**, open **Sign-in method** and enable **Google**.
4. Open **Project settings**, add a **Web app** and keep its config values for the next step.

### 3. Connect the app to your project

Create your `.env` file and fill it in with the web app config:

```bash
cp .env.example .env
```

Then make two edits:

- In `.firebaserc`, replace the project ID with your own.
- In `firestore.rules`, replace the email address with your own Google account. **Don't skip this:**
  it's the only account that can open your budget, so with the email left as it is, you'll be locked
  out.

### 4. Publish the database rules

The app can't load any data until your rules are live:

```bash
npx firebase login
```

```bash
npx firebase deploy --only firestore:rules
```

### 5. Run it

```bash
npm run dev
```

Open http://localhost:5173 and sign in with Google. Your budget is created the first time you sign in.

### 6. Put it online

```bash
npm run deploy
```

This builds the site and publishes it with the database rules to Firebase Hosting, at
`https://<your-project-id>.web.app`. If you use a custom domain, add it under **Authentication** >
**Settings** > **Authorized domains**.

## Importing expenses

On the Expenses page, drop in a CSV file with a header row. It needs `name`, `amount` and `frequency`
(monthly or bi-weekly) columns, and can include a start date. Every row is validated before anything
is saved.

```csv
name,amount,frequency,start date
Rent,1200,monthly,2026-01-01
Daycare,350,bi-weekly,2026-01-02
```

## Good to know

- **Allowing a different account:** edit `firestore.rules`, then run `npm run deploy`.
- **Backups:** your budget is one Firestore document, `budgets/main`. Use **Export** on the Expenses
  page now and then to keep your own copy.
- **Changing an amount:** a new amount applies from the current month on, and earlier months keep
  the old one.
- **Currency:** it's set to US dollars. Change it in the formatters at the bottom of `src/budget.js`.

## Development

```bash
npm test
```

```bash
npm run lint
```

Built with React and Vite. All the budget logic is in `src/budget.js`.

## License

[MIT](LICENSE). You're free to use, change and share it.
