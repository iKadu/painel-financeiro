const router = require('express').Router();
const db = require('../database');
const { autenticar } = require('../middlewares');

// Listar transações ativas do mês
router.get('/', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const result = await db.query(
    `SELECT * FROM transacoes
     WHERE usuario_id = $1
       AND EXTRACT(MONTH FROM data) = $2
       AND EXTRACT(YEAR FROM data) = $3
       AND (excluido = false OR excluido IS NULL)
     ORDER BY data DESC`,
    [req.usuario.id, mes, ano]
  );
  res.json(result.rows);
});

// Listar transações excluídas do mês
router.get('/excluidos', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const result = await db.query(
    `SELECT * FROM transacoes
     WHERE usuario_id = $1
       AND EXTRACT(MONTH FROM data) = $2
       AND EXTRACT(YEAR FROM data) = $3
       AND excluido = true
     ORDER BY excluido_em DESC`,
    [req.usuario.id, mes, ano]
  );
  res.json(result.rows);
});

// Resumo do mês (apenas transações ativas)
router.get('/resumo', autenticar, async (req, res) => {
  const { mes, ano } = req.query;
  const result = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) AS receitas,
       COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) AS despesas
     FROM transacoes
     WHERE usuario_id = $1
       AND EXTRACT(MONTH FROM data) = $2
       AND EXTRACT(YEAR FROM data) = $3
       AND (excluido = false OR excluido IS NULL)`,
    [req.usuario.id, mes, ano]
  );
  const { receitas, despesas } = result.rows[0];
  res.json({ receitas, despesas, saldo: receitas - despesas });
});

// Adicionar transação
router.post('/', autenticar, async (req, res) => {
  const { tipo, categoria, valor, descricao, data } = req.body;
  const result = await db.query(
    `INSERT INTO transacoes (usuario_id, tipo, categoria, valor, descricao, data, excluido, sync_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, gen_random_uuid(), NOW()) RETURNING *`,
    [req.usuario.id, tipo, categoria, valor, descricao, data]
  );
  res.status(201).json(result.rows[0]);
});

// Soft delete (mover para excluídos)
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE transacoes
       SET excluido = true, excluido_em = NOW(), updated_at = NOW()
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Transação não encontrada' });
    }
    res.json({ mensagem: 'Movida para excluídos' });
  } catch (err) {
    console.error('Erro no DELETE:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Restaurar transação excluída
router.patch('/:id/restaurar', autenticar, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE transacoes
       SET excluido = false, excluido_em = NULL, updated_at = NOW()
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [req.params.id, req.usuario.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Transação não encontrada' });
    }
    res.json({ mensagem: 'Transação restaurada' });
  } catch (err) {
    console.error('Erro no RESTORE:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Sync: push local changes, pull server changes
router.post('/sync', autenticar, async (req, res) => {
  const { changes = [], last_pull_at } = req.body;
  const usuario_id = req.usuario.id;
  const now = new Date().toISOString();

  for (const c of changes) {
    if (!c.sync_id) continue;
    await db.query(`
      INSERT INTO transacoes (usuario_id, sync_id, tipo, categoria, valor, descricao, data, excluido, excluido_em, updated_at)
      VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (sync_id) DO UPDATE SET
        tipo        = EXCLUDED.tipo,
        categoria   = EXCLUDED.categoria,
        valor       = EXCLUDED.valor,
        descricao   = EXCLUDED.descricao,
        data        = EXCLUDED.data,
        excluido    = EXCLUDED.excluido,
        excluido_em = EXCLUDED.excluido_em,
        updated_at  = EXCLUDED.updated_at
      WHERE transacoes.usuario_id = $1 AND EXCLUDED.updated_at > transacoes.updated_at
    `, [usuario_id, c.sync_id, c.tipo, c.categoria, parseFloat(c.valor), c.descricao || '', c.data, !!c.excluido, c.excluido_em || null, c.updated_at]);
  }

  const since = last_pull_at || '1970-01-01T00:00:00.000Z';
  const result = await db.query(
    `SELECT * FROM transacoes WHERE usuario_id = $1 AND updated_at > $2 ORDER BY updated_at ASC`,
    [usuario_id, since]
  );

  res.json({ records: result.rows, synced_at: now });
});

module.exports = router;
