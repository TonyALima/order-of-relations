import { Database, Container } from '../../src';
import { UserProfileService } from './services/UserProfileService';

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

  const service = Container.resolve(UserProfileService);

  const profileId = await service.createProfile('UNIFEI student and software developer');
  console.log('Created profile with ID:', profileId);

  const userId = await service.createUser('Alice', 'alice@email.com', profileId);
  console.log('Created user with ID:', userId);

  const userWithProfile = await service.findUserWithProfile(userId);
  console.log('User with profile:', userWithProfile);

  const users = await service.listUsers();
  console.log('All users:', users);
}

main();
