import { Service, InjectRepository } from "../core/service-decorators"
import { User } from "../entities/User"
import { Repository } from "../core/repository"

@Service()
export class UserService {

  @InjectRepository(User)
  private userRepository!: Repository<User>

  async createUser(name: string, email: string) {
    await this.userRepository.save({
      name,
      email
    })
  }

  async listUsers() {
    return this.userRepository.findAll()
  }
}
