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

  const userId = await userService.createUser('Maria', 'maria@email.com');
  console.log('Created user with ID:', userId);
  const user = await userService.findOne(userId);
  console.log('Created user:', user);
  const users = await userService.listUsers();
  console.log('All users:', users);
}

main();
