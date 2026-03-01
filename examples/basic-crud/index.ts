import { Database, Container } from '../../src';
import { UserService } from './services/UserService';

declare module 'bun' {
  interface Env {
    DATABASE_URL: string;
  }
}

// Connect using DATABASE_URL env var (e.g., postgres://user:pass@host:5432/dbname)
async function main() {
  Database.connect();

  const userService = Container.resolve(UserService);

  await userService.createUser('Maria', 'maria@email.com');

  const users = await userService.listUsers();
  console.log(users);
}

main();
