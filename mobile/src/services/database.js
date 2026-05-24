import * as SQLite from 'expo-sqlite';

let db = null;

export const getDB = () => db;

export const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const initDatabase = async () => {
  db = await SQLite.openDatabaseAsync('financeiro.db');

  // Read current schema version
  const versionRow = await db.getFirstAsync('PRAGMA user_version');
  const version = versionRow?.user_version ?? 0;

  if (version === 0) {
    // Fresh install — create schema v2 directly
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
        excluido_em TEXT,
        sync_id     TEXT,
        server_id   INTEGER,
        updated_at  TEXT,
        synced_at   TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_id ON transacoes(sync_id) WHERE sync_id IS NOT NULL;
      PRAGMA user_version = 2;
    `);
  } else if (version === 1) {
    // Existing install — add sync columns
    await db.execAsync(`PRAGMA journal_mode = WAL;`);
    await db.runAsync(`ALTER TABLE transacoes ADD COLUMN sync_id TEXT`);
    await db.runAsync(`ALTER TABLE transacoes ADD COLUMN server_id INTEGER`);
    await db.runAsync(`ALTER TABLE transacoes ADD COLUMN updated_at TEXT`);
    await db.runAsync(`ALTER TABLE transacoes ADD COLUMN synced_at TEXT`);
    await db.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_id ON transacoes(sync_id) WHERE sync_id IS NOT NULL;`);
    await db.execAsync(`PRAGMA user_version = 2;`);
  }
  // version === 2: already current, nothing to do
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
    `INSERT INTO transacoes (email, tipo, categoria, valor, descricao, data, sync_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    email, transacao.tipo, transacao.categoria,
    parseFloat(transacao.valor), transacao.descricao || '', transacao.data,
    generateUUID(), new Date().toISOString()
  );
  return result.lastInsertRowId;
};

export const excluirTransacao = async (id) => {
  await db.runAsync(
    `UPDATE transacoes
     SET excluido = 1, excluido_em = datetime('now'), updated_at = datetime('now'), synced_at = NULL
     WHERE id = ?`,
    id
  );
};

export const restaurarTransacao = async (id) => {
  await db.runAsync(
    `UPDATE transacoes
     SET excluido = 0, excluido_em = NULL, updated_at = datetime('now'), synced_at = NULL
     WHERE id = ?`,
    id
  );
};
