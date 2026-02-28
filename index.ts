import { Database } from "./src/core/database"
import { Container } from "./src/core/container"
import { UserService } from "./src/services/UserService"

async function main() {
  Database.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
  })

  const userService = Container.resolve(UserService)

  await userService.createUser("Maria", "maria@email.com")

  const users = await userService.listUsers()
  console.log(users)
}

main()