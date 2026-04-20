import { Repository } from '../../../src';
import { db } from '../db';
import { User } from '../entities/User';

export class UserService {
  private userRepository!: Repository<User>;

  constructor() {
    this.userRepository = new Repository(User, db);
  }

  async createUser(name: string, email: string) {
    return this.userRepository.create({ name, email });
  }

  async listUsers() {
    return this.userRepository.findMany();
  }

  async findOne(id: User['id']) {
    return this.userRepository.findById({ id });
  }
}
