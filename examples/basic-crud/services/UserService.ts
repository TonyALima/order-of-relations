import { Repository } from '../../../src';
import type { PKInput } from '../../../src/core/repository/repository';
import { db } from '../db';
import { User } from '../entities/User';

export class UserService {
  private userRepository!: Repository<User>;

  constructor() {
    this.userRepository = new Repository(User, db);
  }

  async createUser(name: string, email: string) {
    const created = await this.userRepository.create({ name, email });
    return created;
  }

  async listUsers() {
    return this.userRepository.findMany();
  }

  async findOne(key: PKInput<User>) {
    return this.userRepository.findById(key);
  }
}
