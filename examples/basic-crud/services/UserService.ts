import { Service, InjectRepository, Repository } from "../../../src"
import { User } from "../entities/User"

@Service()
export class UserService {
  @InjectRepository(User)
  private userRepository!: Repository<User>

  async createUser(name: string, email: string) {
    await this.userRepository.save({ name, email })
  }

  async listUsers() {
    return this.userRepository.findAll()
  }
}
