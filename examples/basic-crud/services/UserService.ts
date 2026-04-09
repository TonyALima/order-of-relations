import { Repository } from '../../../src';
import { User } from '../entities/User';

export class UserService {
  private userRepository!: Repository<User>;

  constructor() {
    this.userRepository = new Repository(User);
  }

  async createUser(name: string, email: string) {
    return this.userRepository.create({ name, email });
  }

  async listUsers() {
    return this.userRepository.findMany();
  }

  async findOne(id: User['id']) {
    return this.userRepository.findById(id);
  }
}
