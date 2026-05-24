import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { getDB, generateUUID } from './database';

export const syncWithServer = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const email = await AsyncStorage.getItem('email');
    if (!token || !email) return false;

    const db = getDB();
    if (!db) return false;

    // Assign sync_id to any records that don't have one yet
    const noId = await db.getAllAsync('SELECT id FROM transacoes WHERE sync_id IS NULL');
    for (const r of noId) {
      await db.runAsync(
        'UPDATE transacoes SET sync_id = ?, updated_at = ? WHERE id = ?',
        [generateUUID(), new Date().toISOString(), r.id]
      );
    }

    // Get unsynced (dirty) records
    const dirty = await db.getAllAsync('SELECT * FROM transacoes WHERE synced_at IS NULL');
    const lastPullAt = await AsyncStorage.getItem('last_pull_at');

    const changes = dirty.map(r => ({
      sync_id: r.sync_id,
      tipo: r.tipo,
      categoria: r.categoria,
      valor: r.valor,
      descricao: r.descricao || '',
      data: r.data,
      excluido: r.excluido === 1,
      excluido_em: r.excluido_em || null,
      updated_at: r.updated_at || new Date().toISOString(),
    }));

    const { data } = await api.post('/transacoes/sync', { changes, last_pull_at: lastPullAt });
    const { records, synced_at } = data;

    // Upsert server records into local DB
    for (const r of records) {
      const existing = await db.getFirstAsync(
        'SELECT id, updated_at FROM transacoes WHERE sync_id = ?',
        [r.sync_id]
      );
      const serverUpdatedAt = r.updated_at ? new Date(r.updated_at).toISOString() : synced_at;

      if (!existing) {
        await db.runAsync(
          `INSERT OR IGNORE INTO transacoes
           (email, sync_id, server_id, tipo, categoria, valor, descricao, data, excluido, excluido_em, updated_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [email, r.sync_id, r.id, r.tipo, r.categoria, parseFloat(r.valor),
           r.descricao || '', r.data, r.excluido ? 1 : 0, r.excluido_em || null,
           serverUpdatedAt, synced_at]
        );
      } else if (!existing.updated_at || serverUpdatedAt > existing.updated_at) {
        await db.runAsync(
          `UPDATE transacoes
           SET tipo=?, categoria=?, valor=?, descricao=?, data=?, excluido=?,
               excluido_em=?, updated_at=?, synced_at=?, server_id=?
           WHERE sync_id=?`,
          [r.tipo, r.categoria, parseFloat(r.valor), r.descricao || '', r.data,
           r.excluido ? 1 : 0, r.excluido_em || null, serverUpdatedAt, synced_at, r.id, r.sync_id]
        );
      }
    }

    // Mark locally dirty records as synced
    await db.runAsync(`UPDATE transacoes SET synced_at = ? WHERE synced_at IS NULL`, [synced_at]);
    await AsyncStorage.setItem('last_pull_at', synced_at);

    return true;
  } catch (err) {
    console.warn('[sync] failed:', err.message);
    return false;
  }
};
