import { Database } from 'sqlite';
import { PointType, BalanceRow, TransactionInsert } from './types.js';

export class PointsRepository {
  constructor(private db: Database) {}

  async getPointType(typeKey: string): Promise<PointType | null> {
    const row = await this.db.get(
      'SELECT key, name, daily_limit_count, is_enabled FROM point_types WHERE key = ?',
      typeKey
    );
    
    if (!row) return null;
    
    return {
      key: row.key,
      name: row.name,
      dailyLimitCount: row.daily_limit_count,
      isEnabled: Boolean(row.is_enabled),
    };
  }

  async upsertBalance(
    guildId: string,
    userId: string,
    typeKey: string,
    delta: number
  ): Promise<number> {
    await this.db.run(
      `
      INSERT INTO user_points (guild_id, user_id, type_key, balance)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id, user_id, type_key) 
      DO UPDATE SET balance = balance + excluded.balance
      `,
      guildId,
      userId,
      typeKey,
      delta
    );

    // 更新後の残高を取得
    const result = await this.db.get(
      'SELECT balance FROM user_points WHERE guild_id = ? AND user_id = ? AND type_key = ?',
      guildId,
      userId,
      typeKey
    );

    return result?.balance || 0;
  }

  async getBalance(
    guildId: string,
    userId: string,
    typeKey: string
  ): Promise<number> {
    const result = await this.db.get(
      'SELECT balance FROM user_points WHERE guild_id = ? AND user_id = ? AND type_key = ?',
      guildId,
      userId,
      typeKey
    );

    return result?.balance || 0;
  }

  async getAllBalances(
    guildId: string,
    userId: string
  ): Promise<BalanceRow[]> {
    const rows = await this.db.all(
      'SELECT guild_id, user_id, type_key, balance FROM user_points WHERE guild_id = ? AND user_id = ?',
      guildId,
      userId
    );

    return rows.map(row => ({
      guildId: row.guild_id,
      userId: row.user_id,
      typeKey: row.type_key,
      balance: row.balance,
    }));
  }

  async insertTransaction(tx: TransactionInsert): Promise<void> {
    await this.db.run(
      `
      INSERT INTO point_transactions 
      (id, guild_id, type_key, giver_user_id, receiver_user_id, amount, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      tx.id,
      tx.guildId,
      tx.typeKey,
      tx.giverUserId,
      tx.receiverUserId,
      tx.amount,
      tx.message,
      tx.createdAt
    );
  }

  async countGiverTransactionsInRange(
    guildId: string,
    typeKey: string,
    giverUserId: string,
    fromIso: string,
    toIso: string
  ): Promise<number> {
    const result = await this.db.get(
      `
      SELECT COUNT(*) as count 
      FROM point_transactions 
      WHERE guild_id = ? 
        AND type_key = ? 
        AND giver_user_id = ? 
        AND created_at >= ? 
        AND created_at < ?
      `,
      guildId,
      typeKey,
      giverUserId,
      fromIso,
      toIso
    );

    return result?.count || 0;
  }

  async topBalancesByType(
    guildId: string,
    typeKey: string,
    limit: number
  ): Promise<BalanceRow[]> {
    const rows = await this.db.all(
      `
      SELECT guild_id, user_id, type_key, balance 
      FROM user_points 
      WHERE guild_id = ? AND type_key = ?
      ORDER BY balance DESC
      LIMIT ?
      `,
      guildId,
      typeKey,
      limit
    );

    return rows.map(row => ({
      guildId: row.guild_id,
      userId: row.user_id,
      typeKey: row.type_key,
      balance: row.balance,
    }));
  }
}
