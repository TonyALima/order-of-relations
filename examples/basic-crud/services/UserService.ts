import { Service, InjectRepository, Repository } from '../../../src';
import { User } from '../entities/User';

@Service()
export class UserService {
  @InjectRepository(User)
  private userRepository!: Repository<User>;

  async createUser(name: string, email: string) {
    return this.userRepository.create({ name, email });
  }

  async listUsers() {
    return this.userRepository.findAll();
  }

  async findOne(id: User['id']) {
    return this.userRepository.findOne(id);
  }
}
