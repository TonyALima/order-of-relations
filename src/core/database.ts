import { Pool, type PoolConfig } from "pg"

export class Database {
  private static pool: Pool

  static connect(config: PoolConfig) {
    this.pool = new Pool(config)
  }

  static async query(sql: string, params?: unknown[]) {
    return this.pool.query(sql, params)
  }
}