// electron/main/ipc/handlers/db.ts
import sqlite3 from 'sqlite3';
import { handle } from '../ipc/router';

function withDb<T>(filePath: string, cb: (db: sqlite3.Database) => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const db = new sqlite3.Database(filePath, async (err) => {
      if (err) return reject(err);
      try {
        const out = await cb(db);
        db.close((cerr) => (cerr ? reject(cerr) : resolve(out)));
      } catch (e) {
        db.close(() => reject(e));
      }
    });
  });
}

export function registerDbHandlers() {
  handle('create-database', async (_e, filePath) => {
    await withDb<void>(filePath, async () => {});
  });

  handle('insert-training-data', async (_e, data) => {
    await withDb<void>(data.dbPath, (db) => new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS training_data (
          timestamp INTEGER PRIMARY KEY,
          leftEyeFrame TEXT, rightEyeFrame TEXT,
          theta1 REAL, theta2 REAL, openness REAL, type TEXT
        )`,
        (err) => {
          if (err) return reject(err);
          db.run(
            `INSERT INTO training_data
             (timestamp,leftEyeFrame,rightEyeFrame,theta1,theta2,openness,type)
             VALUES (?,?,?,?,?,?,?)`,
            [data.timestamp, data.leftEyeFrame, data.rightEyeFrame, data.theta1, data.theta2, data.openness, data.type],
            (err2) => (err2 ? reject(err2) : resolve())
          );
        }
      );
    }));
  });

  handle('delete-recent-training-data', async (_e, { dbPath, cutoff }) => {
    await withDb<void>(dbPath, (db) => new Promise((resolve, reject) => {
      db.run(`DELETE FROM training_data WHERE timestamp >= ?`, [cutoff], (err) => (err ? reject(err) : resolve()));
    }));
  });

  handle('count-training-data', async (_e, filePath) => {
    return await withDb<number>(filePath, (db) => new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS training_data (
          timestamp INTEGER PRIMARY KEY,
          leftEyeFrame TEXT, rightEyeFrame TEXT,
          theta1 REAL, theta2 REAL, openness REAL, type TEXT
        )`,
        (err) => {
          if (err) return reject(err);
          db.get(`SELECT COUNT(*) as count FROM training_data`, (err2, row: any) =>
            err2 ? reject(err2) : resolve(row?.count ?? 0)
          );
        }
      );
    }));
  });
}
