import { Service, InjectRepository, Repository } from '../../../src';
import { User } from '../entities/User';
import { AdminUser } from '../entities/AdminUser';

@Service()
export class UserHierarchyService {
  @InjectRepository(User)
  private userRepository!: Repository<User>;

  @InjectRepository(AdminUser)
  private adminRepository!: Repository<AdminUser>;

  async createRegularUser(name: string, email: string) {
    return this.userRepository.create({ name, email });
  }

  async createAdmin(name: string, email: string, permissionLevel: string) {
    return this.adminRepository.create({ name, email, permissionLevel });
  }

  async listUsers() {
    return this.userRepository.findAll();
  }

  async listAdmins() {
    return this.adminRepository.findAll();
  }
}
