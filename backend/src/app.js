const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Migração automática: garante colunas de soft delete e sync
(async () => {
  try {
    await db.query(`ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS excluido BOOLEAN DEFAULT false;`);
    await db.query(`ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMP;`);
    await db.query(`ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS sync_id UUID;`);
    await db.query(`ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS transacoes_sync_id_key ON transacoes(sync_id) WHERE sync_id IS NOT NULL;`);
    await db.query(`UPDATE transacoes SET sync_id = gen_random_uuid() WHERE sync_id IS NULL;`);
    await db.query(`UPDATE transacoes SET updated_at = NOW() WHERE updated_at IS NULL;`);
    console.log('Migração de soft delete e sync aplicada com sucesso.');
  } catch (err) {
    console.error('Erro na migração:', err.message);
  }
})();

app.use('/auth', require('./routes/auth'));
app.use('/transacoes', require('./routes/transacoes'));

app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`);
});
