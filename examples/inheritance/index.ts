import { UserHierarchyService } from './services/UserHierarchyService';

declare module 'bun' {
  interface Env {
    DATABASE_URL: string;
  }
}

async function main() {
  const db = Database.getInstance();
  db.connect();
  await db.drop();
  await db.create();

  const userService = new UserHierarchyService();

  const userId = await userService.createRegularUser('Alice', 'alice@email.com');
  const adminId = await userService.createAdmin('Maria', 'maria@email.com', 'super-admin');

  console.log('Created user id:', userId);
  console.log('Created admin id:', adminId);

  const users = await userService.listUsers();
  const admins = await userService.listAdmins();

  console.log('All users from users table:', users);
  console.log('All admins from users table:', admins);

  const allSubClassUsers = await userService.listSubClassUsers();
  const allSubClassAdmins = await userService.listSubClassAdmins();

  console.log('All users sub classes from users table:', allSubClassUsers);
  console.log('All admins sub classes from users table:', allSubClassAdmins);
}

main();
