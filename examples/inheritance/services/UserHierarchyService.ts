import { Repository } from '../../../src';
import { User } from '../entities/User';
import { AdminUser } from '../entities/AdminUser';
import { InheritanceSearchType } from '../../../src/query-builder/types';
import { db } from '../db';

export class UserHierarchyService {
  private userRepository!: Repository<User>;

  private adminRepository!: Repository<AdminUser>;

  constructor() {
    this.userRepository = new Repository(User, db);
    this.adminRepository = new Repository(AdminUser, db);
  }

  async createRegularUser(name: string, email: string): Promise<User['id']> {
    const created = await this.userRepository.create({ name, email });
    return created.id!;
  }

  async createAdmin(
    name: string,
    email: string,
    permissionLevel: string,
  ): Promise<AdminUser['id']> {
    const created = await this.adminRepository.create({ name, email, permissionLevel });
    return created.id!;
  }

  async listUsers() {
    return this.userRepository.findMany();
  }

  async listSubClassUsers() {
    return this.userRepository.findMany({ inheritance: InheritanceSearchType.SUBCLASSES });
  }

  async listAdmins() {
    return this.adminRepository.findMany();
  }

  async listSubClassAdmins() {
    return this.adminRepository.findMany({ inheritance: InheritanceSearchType.SUBCLASSES });
  }
}
