import { Database, Container } from "../../src"
import { UserService } from "./services/UserService"

declare module "bun" {
  interface Env {
    DB_USER: string;
    DB_PASSWORD: string;
    DB_NAME: string;
    DB_HOST: string;
    DB_PORT: string;
  }
}

async function main() {
  Database.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
  })

  const userService = Container.resolve(UserService)

  await userService.createUser("Maria", "maria@email.com")

  const users = await userService.listUsers()
  console.log(users)
}

main()
