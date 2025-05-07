import { Types } from 'mongoose';
import { User } from '../models/User';

class UserService {
  static async getUserDetails(userId: string) {
    const user = await User.findById(new Types.ObjectId(userId))
      .select('-password') // Exclude password from the response
      .populate('companies', 'name')
      .populate('roles.company', 'name');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export default UserService; 