import { Service, InjectRepository, Repository } from '../../../src';
import { User } from '../entities/User';
import { UserProfile } from '../entities/UserProfile';

@Service()
export class UserProfileService {
  @InjectRepository(User)
  private userRepository!: Repository<User>;

  @InjectRepository(UserProfile)
  private profileRepository!: Repository<UserProfile>;

  async createProfile(bio: string) {
    return this.profileRepository.create({ bio });
  }

  async createUser(name: string, email: string, profileId: User['profileId']) {
    return this.userRepository.create({ name, email, profileId });
  }

  async findUserWithProfile(userId: User['id']) {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    const profile = await this.profileRepository.findById(user.profileId);
    return { ...user, profile };
  }

  async listUsers() {
    return this.userRepository.findMany();
  }
}
