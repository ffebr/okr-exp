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

  static async findUserByEmail(email: string) {
    try {
      // Create a case-insensitive regex pattern for partial email match
      const searchPattern = new RegExp(email, 'i');
      
      const users = await User.find({ email: searchPattern })
        .select('_id name email roles')
        .limit(10); // Limit results to prevent overwhelming response

      if (!users.length) {
        throw new Error('No users found');
      }

      return users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles
      }));
    } catch (error) {
      console.error('Error in findUserByEmail:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while finding users by email');
    }
  }
}

export default UserService; 