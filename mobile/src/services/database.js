import * as SQLite from 'expo-sqlite';

let db = null;

export const initDatabase = async () => {
  db = await SQLite.openDatabaseAsync('financeiro.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transacoes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL,
      tipo        TEXT    NOT NULL,
      categoria   TEXT    NOT NULL,
      valor       REAL    NOT NULL,
      descricao   TEXT    DEFAULT '',
      data        TEXT    NOT NULL,
      excluido    INTEGER DEFAULT 0,
      excluido_em TEXT
    );
  `);
};

export const getTransacoesLocal = async (email, mes, ano) => {
  const m = String(mes).padStart(2, '0');
  return await db.getAllAsync(
    `SELECT * FROM transacoes
     WHERE email = ? AND strftime('%m', data) = ? AND strftime('%Y', data) = ?
       AND excluido = 0
     ORDER BY data DESC`,
    email, m, String(ano)
  );
};

export const getExcluidasLocal = async (email, mes, ano) => {
  const m = String(mes).padStart(2, '0');
  return await db.getAllAsync(
    `SELECT * FROM transacoes
     WHERE email = ? AND strftime('%m', data) = ? AND strftime('%Y', data) = ?
       AND excluido = 1
     ORDER BY excluido_em DESC`,
    email, m, String(ano)
  );
};

export const getResumoLocal = async (email, mes, ano) => {
  const m = String(mes).padStart(2, '0');
  const row = await db.getFirstAsync(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo='receita' THEN valor ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN tipo='despesa' THEN valor ELSE 0 END), 0) AS despesas
     FROM transacoes
     WHERE email = ? AND strftime('%m', data) = ? AND strftime('%Y', data) = ?
       AND excluido = 0`,
    email, m, String(ano)
  );
  const receitas = parseFloat(row?.receitas ?? 0);
  const despesas = parseFloat(row?.despesas ?? 0);
  return { receitas, despesas, saldo: receitas - despesas };
};

export const criarTransacao = async (email, transacao) => {
  const result = await db.runAsync(
    `INSERT INTO transacoes (email, tipo, categoria, valor, descricao, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    email, transacao.tipo, transacao.categoria,
    parseFloat(transacao.valor), transacao.descricao || '', transacao.data
  );
  return result.lastInsertRowId;
};

export const excluirTransacao = async (id) => {
  await db.runAsync(
    `UPDATE transacoes SET excluido = 1, excluido_em = datetime('now') WHERE id = ?`,
    id
  );
};

export const restaurarTransacao = async (id) => {
  await db.runAsync(
    `UPDATE transacoes SET excluido = 0, excluido_em = NULL WHERE id = ?`,
    id
  );
};
