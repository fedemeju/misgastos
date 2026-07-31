import * as SQLite from 'expo-sqlite';

// Base de datos local en el teléfono. Todo queda offline y privado.
let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('gastos.db');
  }
  return dbPromise;
}

export async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      merchant TEXT,
      date TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'cash',
      currency TEXT NOT NULL DEFAULT 'ARS',
      balance REAL NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ARS',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'otros',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migraciones de columnas de expenses.
  const cols = await db.getAllAsync(`PRAGMA table_info(expenses)`);
  const hasCol = (n) => cols.some((c) => c.name === n);
  if (!hasCol('account_id')) await db.execAsync(`ALTER TABLE expenses ADD COLUMN account_id INTEGER`);
  if (!hasCol('group_id')) await db.execAsync(`ALTER TABLE expenses ADD COLUMN group_id TEXT`);
  if (!hasCol('group_label')) await db.execAsync(`ALTER TABLE expenses ADD COLUMN group_label TEXT`);

  // Migración: moneda en deudas.
  const debtCols = await db.getAllAsync(`PRAGMA table_info(debts)`);
  if (!debtCols.some((c) => c.name === 'currency')) {
    await db.execAsync(`ALTER TABLE debts ADD COLUMN currency TEXT NOT NULL DEFAULT 'ARS'`);
  }

  // Cuentas por defecto la primera vez.
  const cnt = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM accounts`);
  if (cnt.n === 0) {
    await db.runAsync(`INSERT INTO accounts (name, kind, currency, sort) VALUES ('Efectivo pesos', 'cash', 'ARS', 0)`);
    await db.runAsync(`INSERT INTO accounts (name, kind, currency, sort) VALUES ('Dólares', 'cash', 'USD', 1)`);
    await db.runAsync(`INSERT INTO accounts (name, kind, currency, sort) VALUES ('Bitcoin', 'crypto', 'BTC', 2)`);
  }
}

// ---- Cuentas / saldos ----

export async function getAccounts() {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM accounts ORDER BY sort, id`);
}

export async function getCashArsAccounts() {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM accounts WHERE currency = 'ARS' ORDER BY sort, id`);
}

export async function addAccount({ name, kind, currency }) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM accounts`);
  const result = await db.runAsync(
    `INSERT INTO accounts (name, kind, currency, balance, sort) VALUES (?, ?, ?, 0, ?)`,
    [name, kind || 'cash', currency || 'ARS', row.s]
  );
  return result.lastInsertRowId;
}

export async function deleteAccount(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
}

export async function renameAccount(id, name) {
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET name = ? WHERE id = ?', [name, id]);
}

// Suma (delta positivo) o resta (delta negativo) al saldo.
export async function adjustAccountBalance(id, delta) {
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [Number(delta) || 0, id]);
}

export async function setAccountBalance(id, value) {
  const db = await getDb();
  await db.runAsync('UPDATE accounts SET balance = ? WHERE id = ?', [Number(value) || 0, id]);
}

// ---- Gastos ----

export async function addExpense({ description, amount, category, merchant, date, source, accountId }) {
  const db = await getDb();
  const value = Number(amount) || 0;
  const result = await db.runAsync(
    `INSERT INTO expenses (description, amount, category, merchant, date, source, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      description,
      value,
      category,
      merchant || null,
      date || new Date().toISOString().slice(0, 10),
      source || 'manual',
      accountId || null,
    ]
  );
  // Si se pagó con una cuenta (efectivo), se descuenta del saldo.
  if (accountId) {
    await db.runAsync('UPDATE accounts SET balance = balance - ? WHERE id = ?', [value, accountId]);
  }
  return result.lastInsertRowId;
}

// Devuelve al saldo de las cuentas el importe de los gastos que se van a borrar.
async function restoreBalances(db, ids) {
  if (!ids || ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync(
    `SELECT account_id, SUM(amount) AS total FROM expenses
      WHERE id IN (${placeholders}) AND account_id IS NOT NULL GROUP BY account_id`,
    ids
  );
  for (const r of rows) {
    await db.runAsync('UPDATE accounts SET balance = balance + ? WHERE id = ?', [r.total, r.account_id]);
  }
}

export async function addExpensesBatch(items, groupId = null, groupLabel = null) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const it of items) {
      await db.runAsync(
        `INSERT INTO expenses (description, amount, category, merchant, date, source, group_id, group_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          it.description,
          Number(it.amount) || 0,
          it.category,
          it.merchant || null,
          it.date || new Date().toISOString().slice(0, 10),
          it.source || 'scan',
          groupId,
          groupLabel,
        ]
      );
    }
  });
}

export async function getExpensesByGroup(groupId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM expenses WHERE group_id = ? ORDER BY date DESC, id DESC`,
    [groupId]
  );
}

export async function deleteExpense(id) {
  const db = await getDb();
  await restoreBalances(db, [id]);
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function deleteExpenses(ids) {
  if (!ids || ids.length === 0) return;
  const db = await getDb();
  await restoreBalances(db, ids);
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM expenses WHERE id IN (${placeholders})`, ids);
}

export async function deleteExpensesByMonth(month) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT id FROM expenses WHERE substr(date, 1, 7) = ?`,
    [month]
  );
  await restoreBalances(db, rows.map((r) => r.id));
  await db.runAsync('DELETE FROM expenses WHERE substr(date, 1, 7) = ?', [month]);
}

// Devuelve los gastos de un mes concreto (formato "YYYY-MM").
export async function getExpensesByMonth(month) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM expenses WHERE substr(date, 1, 7) = ? ORDER BY date DESC, id DESC`,
    [month]
  );
}

// Gastos de una categoría concreta en un mes.
export async function getExpensesByCategoryMonth(category, month) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM expenses WHERE substr(date, 1, 7) = ? AND category = ? ORDER BY date DESC, id DESC`,
    [month, category]
  );
}

// Totales por categoría para un mes.
export async function getTotalsByCategory(month) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT category, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses WHERE substr(date, 1, 7) = ?
      GROUP BY category ORDER BY total DESC`,
    [month]
  );
}

export async function getExpense(id) {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM expenses WHERE id = ?', [id]);
}

// Edita un gasto (no reajusta saldos de efectivo).
export async function updateExpense(id, { description, amount, category, merchant, date }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE expenses SET description = ?, amount = ?, category = ?, merchant = ?, date = ? WHERE id = ?`,
    [description, Number(amount) || 0, category, merchant || null, date, id]
  );
}

// Total de gastos por mes (para evolución / balance).
export async function getExpenseTotalByMonth(month) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE substr(date, 1, 7) = ?`,
    [month]
  );
  return row ? row.total : 0;
}

// ---- Ingresos ----

export async function addIncome({ description, amount, category, date }) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO incomes (description, amount, category, date) VALUES (?, ?, ?, ?)`,
    [description, Number(amount) || 0, category || 'otros', date || new Date().toISOString().slice(0, 10)]
  );
  return result.lastInsertRowId;
}

export async function updateIncome(id, { description, amount, category, date }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE incomes SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?`,
    [description, Number(amount) || 0, category || 'otros', date, id]
  );
}

export async function getIncome(id) {
  const db = await getDb();
  return db.getFirstAsync('SELECT * FROM incomes WHERE id = ?', [id]);
}

export async function getIncomesByMonth(month) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM incomes WHERE substr(date, 1, 7) = ? ORDER BY date DESC, id DESC`,
    [month]
  );
}

export async function getIncomeTotalByMonth(month) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM incomes WHERE substr(date, 1, 7) = ?`,
    [month]
  );
  return row ? row.total : 0;
}

export async function deleteIncome(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM incomes WHERE id = ?', [id]);
}

// ---- Deudas ----

export async function getDebts() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT d.*, COALESCE(SUM(p.amount), 0) AS paid, COUNT(p.id) AS payments
       FROM debts d LEFT JOIN debt_payments p ON p.debt_id = d.id
      GROUP BY d.id ORDER BY d.id DESC`
  );
}

export async function getDebt(id) {
  const db = await getDb();
  return db.getFirstAsync(
    `SELECT d.*, COALESCE(SUM(p.amount), 0) AS paid
       FROM debts d LEFT JOIN debt_payments p ON p.debt_id = d.id
      WHERE d.id = ? GROUP BY d.id`,
    [id]
  );
}

export async function addDebt({ name, total, currency }) {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO debts (name, total, currency) VALUES (?, ?, ?)',
    [name, Number(total) || 0, currency || 'ARS']
  );
  return result.lastInsertRowId;
}

export async function deleteDebt(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM debt_payments WHERE debt_id = ?', [id]);
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

export async function getDebtPayments(debtId) {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC, id DESC', [debtId]);
}

export async function addDebtPayment({ debtId, amount, date, note }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO debt_payments (debt_id, amount, date, note) VALUES (?, ?, ?, ?)',
    [debtId, Number(amount) || 0, date, note || null]
  );
}

export async function deleteDebtPayment(id) {
  const db = await getDb();
  await db.runAsync('DELETE FROM debt_payments WHERE id = ?', [id]);
}

// ---- Backup (exportar / importar todo) ----

export async function exportAllData() {
  const db = await getDb();
  const [expenses, incomes, accounts, debts, debtPayments, settings] = await Promise.all([
    db.getAllAsync('SELECT * FROM expenses'),
    db.getAllAsync('SELECT * FROM incomes'),
    db.getAllAsync('SELECT * FROM accounts'),
    db.getAllAsync('SELECT * FROM debts'),
    db.getAllAsync('SELECT * FROM debt_payments'),
    db.getAllAsync("SELECT * FROM settings WHERE key != 'gemini_api_key'"),
  ]);
  return { app: 'gastos-app', version: 2, exportedAt: new Date().toISOString(), expenses, incomes, accounts, debts, debtPayments, settings };
}

export async function importAllData(data) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM expenses; DELETE FROM incomes; DELETE FROM accounts; DELETE FROM debts; DELETE FROM debt_payments;');
    for (const i of data.incomes || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO incomes (id, description, amount, category, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [i.id, i.description, i.amount, i.category ?? 'otros', i.date, i.created_at ?? null]
      );
    }
    for (const e of data.expenses || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO expenses (id, description, amount, category, merchant, date, source, created_at, account_id, group_id, group_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.id, e.description, e.amount, e.category, e.merchant ?? null, e.date, e.source ?? 'manual', e.created_at ?? null, e.account_id ?? null, e.group_id ?? null, e.group_label ?? null]
      );
    }
    for (const a of data.accounts || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO accounts (id, name, kind, currency, balance, sort) VALUES (?, ?, ?, ?, ?, ?)`,
        [a.id, a.name, a.kind ?? 'cash', a.currency ?? 'ARS', a.balance ?? 0, a.sort ?? 0]
      );
    }
    for (const d of data.debts || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO debts (id, name, total, currency, created_at) VALUES (?, ?, ?, ?, ?)`,
        [d.id, d.name, d.total ?? 0, d.currency ?? 'ARS', d.created_at ?? null]
      );
    }
    for (const p of data.debtPayments || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO debt_payments (id, debt_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [p.id, p.debt_id, p.amount, p.date, p.note ?? null, p.created_at ?? null]
      );
    }
    for (const s of data.settings || []) {
      if (s.key === 'gemini_api_key') continue;
      await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
    }
  });
}

// ---- Settings (clave/valor) ----

export async function getSetting(key) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
