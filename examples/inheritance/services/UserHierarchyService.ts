import { Service, InjectRepository, Repository } from '../../../src';
import { User } from '../entities/User';
import { AdminUser } from '../entities/AdminUser';
import { INHERITANCE_SEARCH_TYPE } from '../../../src/query-builder/types';

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
    return this.userRepository.findMany();
  }

  async listSubClassUsers() {
    return this.userRepository.findMany({ inheritance: INHERITANCE_SEARCH_TYPE.SUBCLASSES });
  }

  async listAdmins() {
    return this.adminRepository.findMany();
  }

  async listSubClassAdmins() {
    return this.adminRepository.findMany({ inheritance: INHERITANCE_SEARCH_TYPE.SUBCLASSES });
  }
}
