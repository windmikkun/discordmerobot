import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
export function getDatabasePath() {
    const fromEnv = process.env.DATABASE_PATH;
    if (fromEnv && fromEnv.trim().length > 0) {
        return fromEnv;
    }
    return path.join(process.cwd(), 'data', 'bot.sqlite');
}
function ensureDirExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
async function createTables(db) {
    await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS point_types (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      daily_limit_count INTEGER NOT NULL,
      is_enabled INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_points (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      type_key TEXT NOT NULL,
      balance INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id, type_key)
    );
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      type_key TEXT NOT NULL,
      giver_user_id TEXT NOT NULL,
      receiver_user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
async function seedInitialData(db) {
    // meroポイントの初期化
    const meroExists = await db.get('SELECT 1 FROM point_types WHERE key = ? LIMIT 1', 'mero');
    if (!meroExists) {
        await db.run(`
      INSERT INTO point_types (key, name, daily_limit_count, is_enabled)
      VALUES (?, ?, ?, ?)
    `, 'mero', 'メロポイント', 10, 1);
    }
    // streamポイントの初期化
    const streamExists = await db.get('SELECT 1 FROM point_types WHERE key = ? LIMIT 1', 'stream');
    if (!streamExists) {
        await db.run(`
      INSERT INTO point_types (key, name, daily_limit_count, is_enabled)
      VALUES (?, ?, ?, ?)
    `, 'stream', '配信ポイント', 0, 1);
    }
}
export async function initDb() {
    const dbPath = getDatabasePath();
    ensureDirExists(dbPath);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    await createTables(db);
    await seedInitialData(db);
    return db;
}
