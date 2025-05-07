import { Types } from 'mongoose';
import Team from '../models/Team';
import { Company } from '../models/Company';
import { User } from '../models/User';

class TeamService {
  static async createTeam(name: string, companyId: string, userId: string) {
    try {
      // Check if company exists
      const company = await Company.findById(companyId);
      if (!company) {
        throw new Error('Company not found');
      }

      // Check if user exists and is in the company
      const user = await User.findById(new Types.ObjectId(userId));
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.companies.some(company => company.toString() === companyId)) {
        throw new Error('User is not in this company');
      }

      // Create new team
      const team = new Team({
        name,
        companyId,
        createdBy: userId,
        members: [{ userId }],
        requiredRoles: []
      });

      await team.save();
      return team;
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's an ObjectId error
        if (error.message.includes('ObjectId')) {
          throw new Error('Invalid ID format');
        }
        // Re-throw other errors
        throw error;
      }
      throw new Error('Failed to create team');
    }
  }

  static async addUserToTeam(teamId: string, userId: string) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in the company
    if (!user.companies.some(company => company.toString() === team.companyId)) {
      throw new Error('User is not in this company');
    }

    // Check if user is already in the team
    if (team.members.some(member => member.userId === userId)) {
      throw new Error('User is already in this team');
    }

    team.members.push({ userId });
    await team.save();
    return team;
  }

  static async removeUserFromTeam(teamId: string, userId: string) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user is in the team
    if (!team.members.some(member => member.userId === userId)) {
      throw new Error('User is not in this team');
    }

    team.members = team.members.filter(member => member.userId !== userId);
    await team.save();
    return team;
  }

  static async addRequiredRole(teamId: string, roleName: string) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if company exists and has the role
    const company = await Company.findById(team.companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    if (!company.roles.some(role => role.name === roleName)) {
      throw new Error('Role not found in company');
    }

    // Check if role is already required
    if (team.requiredRoles.includes(roleName)) {
      throw new Error('Role is already required for this team');
    }

    team.requiredRoles.push(roleName);
    await team.save();
    return team;
  }

  static async addRequiredRoles(teamId: string, roleNames: string[]) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if company exists
    const company = await Company.findById(team.companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Validate all roles exist in company
    const invalidRoles = roleNames.filter(roleName => 
      !company.roles.some(role => role.name === roleName)
    );
    if (invalidRoles.length > 0) {
      throw new Error(`Roles not found in company: ${invalidRoles.join(', ')}`);
    }

    // Filter out roles that are already required
    const newRoles = roleNames.filter(roleName => !team.requiredRoles.includes(roleName));
    if (newRoles.length === 0) {
      throw new Error('All roles are already required for this team');
    }

    team.requiredRoles.push(...newRoles);
    await team.save();
    return team;
  }

  static async removeRequiredRole(teamId: string, roleName: string) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if role is required
    if (!team.requiredRoles.includes(roleName)) {
      throw new Error('Role is not required for this team');
    }

    team.requiredRoles = team.requiredRoles.filter(role => role !== roleName);
    await team.save();
    return team;
  }

  static async getUserTeams(userId: string, companyId: string) {
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Check if user is in the company
    if (!user.companies.some(company => company.toString() === companyId)) {
      throw new Error('User is not in this company');
    }

    // Get all teams where user is a member or has required roles
    const teams = await Team.find({
      companyId,
      $or: [
        { 'members.userId': userId },
        { 
          requiredRoles: { $in: user.roles
            .filter(role => role.company.toString() === companyId)
            .map(role => role.role)
          }
        }
      ]
    });

    return teams;
  }

  static async getTeamDetails(teamId: string) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Populate user details
    const populatedTeam = await Team.findById(new Types.ObjectId(teamId))
      .populate('members.userId', 'name email');

    return populatedTeam;
  }

  static async deleteTeam(teamId: string) {
    const team = await Team.findByIdAndDelete(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }
    return team;
  }

  static async getTeamMembers(teamId: string) {
    const team = await Team.findById(new Types.ObjectId(teamId))
      .populate('members.userId', 'name email');
    
    if (!team) {
      throw new Error('Team not found');
    }

    return team.members;
  }

  static async addUsersToTeam(teamId: string, userIds: string[]) {
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Get all users
    const users = await User.find({ _id: { $in: userIds.map(id => new Types.ObjectId(id)) } });
    if (users.length !== userIds.length) {
      throw new Error('Some users were not found');
    }

    // Check if all users are in the company
    const usersNotInCompany = users.filter(user => 
      !user.companies.some(company => company.toString() === team.companyId)
    );
    if (usersNotInCompany.length > 0) {
      throw new Error(`Users not in company: ${usersNotInCompany.map(u => u.name).join(', ')}`);
    }

    // Filter out users that are already in the team
    const existingUserIds = team.members.map(member => member.userId);
    const newUserIds = userIds.filter(id => !existingUserIds.includes(id));
    if (newUserIds.length === 0) {
      throw new Error('All users are already in this team');
    }

    team.members.push(...newUserIds.map(userId => ({ userId })));
    await team.save();
    return team;
  }
}

export default TeamService; 