import { SQL } from "bun"
export class Database {
  private static connection: SQL

  static connect(url?: string) {
    this.connection = url ? new SQL(url) : new SQL()
  }

  static getConnection(): SQL {
    if (!this.connection) {
      throw new Error("Database not connected. Call Database.connect() first.")
    } 
    return this.connection
  }
}