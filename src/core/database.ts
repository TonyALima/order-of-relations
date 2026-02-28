import { Pool } from "pg"

export class Database {
  private static pool: Pool

  static connect(config: any) {
    this.pool = new Pool(config)
  }

  static async query(sql: string, params?: any[]) {
    return this.pool.query(sql, params)
  }
}