import { Company } from '../models/Company';
import { User } from '../models/User';
import { Types } from 'mongoose';
import Team from '../models/Team';

export class CompanyService {
  // Create a new company
  static async createCompany(name: string, userId: string) {
    const company = new Company({
      name,
      createdBy: userId,
      roles: []
    });

    await company.save();

    // Add company to user's companies array
    await User.findByIdAndUpdate(
      userId,
      { $push: { companies: company._id } }
    );

    return company;
  }

  // Add a new role to company
  static async addRole(companyId: string, name: string, description?: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Check if role already exists
    const roleExists = company.roles.some(role => role.name === name);
    if (roleExists) {
      throw new Error('Role with this name already exists');
    }

    // Add new role
    company.roles.push({ name, description });
    await company.save();

    return company;
  }

  // Get all companies related to user
  static async getUserCompanies(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get companies created by user
    const createdCompanies = await Company.find({ createdBy: userId });

    // Get companies where user is a member
    const memberCompanies = await Company.find({
      _id: { $in: user.companies },
      createdBy: { $ne: userId }
    });

    // Format response
    return {
      createdCompanies: createdCompanies.map(company => ({
        ...company.toObject(),
        userRole: 'creator'
      })),
      memberCompanies: memberCompanies.map(company => {
        const userRoles = user.roles
          .filter(role => role.company.toString() === company._id.toString())
          .map(role => role.role);

        return {
          ...company.toObject(),
          userRoles
        };
      })
    };
  }

  // Add user to company
  static async addUserToCompany(companyId: string, userId: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already in company
    if (user.companies.some(c => c.toString() === companyId)) {
      throw new Error('User is already in this company');
    }

    // Add company to user's companies
    user.companies.push(new Types.ObjectId(companyId));
    await user.save();

    return user;
  }

  // Assign role to user in company
  static async assignRoleToUser(companyId: string, userId: string, role: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Check if role exists in company
    const roleExists = company.roles.some(r => r.name === role);
    if (!roleExists) {
      throw new Error('Invalid role for this company');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in company
    if (!user.companies.some(c => c.toString() === companyId)) {
      throw new Error('User is not in this company');
    }

    // Check if user already has this role
    const userRoleExists = user.roles.some(r => 
      r.company.toString() === companyId && r.role === role
    );
    if (userRoleExists) {
      throw new Error('User already has this role in the company');
    }

    // Add role to user's roles
    user.roles.push({
      company: new Types.ObjectId(companyId),
      role: role
    });

    await user.save();
    return user;
  }

  // Remove role from user in company
  static async removeRoleFromUser(companyId: string, userId: string, role: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in company
    if (!user.companies.some(c => c.toString() === companyId)) {
      throw new Error('User is not in this company');
    }

    // Check if user has this role
    const roleIndex = user.roles.findIndex(r => 
      r.company.toString() === companyId && r.role === role
    );

    if (roleIndex === -1) {
      throw new Error('User doesn\'t have this role in the company');
    }

    // Remove role
    user.roles.splice(roleIndex, 1);

    // If user has no more roles in this company, remove company from user's companies
    const hasOtherRoles = user.roles.some(r => r.company.toString() === companyId);
    if (!hasOtherRoles) {
      const companyIndex = user.companies.findIndex(c => c.toString() === companyId);
      if (companyIndex !== -1) {
        user.companies.splice(companyIndex, 1);
      }
    }

    await user.save();
    return user;
  }

  // Remove role from company and revoke it from all users
  static async removeRoleFromCompany(companyId: string, role: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Check if role exists in company
    const roleIndex = company.roles.findIndex(r => r.name === role);
    if (roleIndex === -1) {
      throw new Error('Role not found in company');
    }

    // Remove role from company
    company.roles.splice(roleIndex, 1);
    await company.save();

    // Find all users who have this role in this company
    const users = await User.find({
      'roles.company': companyId,
      'roles.role': role
    });

    // Remove the role from all users
    for (const user of users) {
      // Remove the specific role
      user.roles = user.roles.filter(r => 
        !(r.company.toString() === companyId && r.role === role)
      );
      await user.save();
    }

    // Find all teams in this company that have this role as required
    const teams = await Team.find({
      companyId,
      requiredRoles: role
    });

    // Remove the role from all teams
    for (const team of teams) {
      team.removeRequiredRole(role);
      await team.save();
    }

    return {
      company,
      affectedUsers: users.length,
      affectedTeams: teams.length
    };
  }

  // Remove user from company
  static async removeUserFromCompany(companyId: string, userId: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in company
    if (!user.companies.some(c => c.toString() === companyId)) {
      throw new Error('User is not in this company');
    }

    // Remove company from user's companies
    user.companies = user.companies.filter(c => c.toString() !== companyId);

    // Remove all roles for this company
    user.roles = user.roles.filter(r => r.company.toString() !== companyId);

    await user.save();
    return user;
  }

  // Get all users in company
  static async getCompanyUsers(companyId: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Find all users who are members of this company
    const users = await User.find({
      companies: companyId
    });

    // Format response with user roles in this company
    return users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles
        .filter(role => role.company.toString() === companyId)
        .map(role => role.role)
    }));
  }

  // Get all roles in company
  static async getCompanyRoles(companyId: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    return company.roles;
  }

  // Get detailed company information including roles and users
  static async getCompanyDetails(companyId: string) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Get all users in the company with their roles
    const users = await User.find({
      companies: companyId
    }).select('-password'); // Exclude password from the response

    // Format the response
    return {
      id: company._id,
      name: company.name,
      createdBy: company.createdBy,
      roles: company.roles,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles
          .filter(role => role.company.toString() === companyId)
          .map(role => role.role)
      })),
      createdAt: company.createdAt,
      updatedAt: company.updatedAt
    };
  }

  // Assign multiple roles to user in company
  static async assignRolesToUser(companyId: string, userId: string, roles: string[]) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Check if all roles exist in company
    const invalidRoles = roles.filter(role => 
      !company.roles.some(r => r.name === role)
    );
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles for this company: ${invalidRoles.join(', ')}`);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in company
    if (!user.companies.some(c => c.toString() === companyId)) {
      throw new Error('User is not in this company');
    }

    // Filter out roles that user already has
    const existingRoles = user.roles
      .filter(r => r.company.toString() === companyId)
      .map(r => r.role);
    
    const newRoles = roles.filter(role => !existingRoles.includes(role));
    if (newRoles.length === 0) {
      throw new Error('User already has all these roles in the company');
    }

    // Add new roles to user's roles
    user.roles.push(...newRoles.map(role => ({
      company: new Types.ObjectId(companyId),
      role: role
    })));

    await user.save();
    return {
      user,
      addedRoles: newRoles
    };
  }

  // Remove multiple roles from user in company
  static async removeRolesFromUser(companyId: string, userId: string, roles: string[]) {
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in company
    if (!user.companies.some(c => c.toString() === companyId)) {
      throw new Error('User is not in this company');
    }

    // Get user's roles for this company
    const userCompanyRoles = user.roles.filter(r => r.company.toString() === companyId);
    const userRoleNames = userCompanyRoles.map(r => r.role);

    // Check if user has all the roles to be removed
    const missingRoles = roles.filter(role => !userRoleNames.includes(role));
    if (missingRoles.length > 0) {
      throw new Error(`User doesn't have these roles in the company: ${missingRoles.join(', ')}`);
    }

    // Remove the roles
    user.roles = user.roles.filter(r => 
      !(r.company.toString() === companyId && roles.includes(r.role))
    );

    // If user has no more roles in this company, remove company from user's companies
    const hasOtherRoles = user.roles.some(r => r.company.toString() === companyId);
    if (!hasOtherRoles) {
      user.companies = user.companies.filter(c => c.toString() !== companyId);
    }

    await user.save();
    return {
      user,
      removedRoles: roles
    };
  }
} 