import { Types, Document } from 'mongoose';
import { OKR, IOKR } from '../models/OKR';
import { OKRStats } from '../models/OKRStats';
import Team from '../models/Team';
import { User } from '../models/User';

interface KeyResultInput {
  title: string;
  description?: string;
  metricType: 'number' | 'percentage' | 'currency' | 'custom';
  startValue: number;
  targetValue: number;
  unit?: string;
}

type OKRDocument = IOKR & Document;

class OKRService {
  static async createOKR(
    teamId: string,
    userId: string,
    objective: string,
    description?: string,
    keyResults?: KeyResultInput[],
    isFrozen?: boolean,
    deadline?: Date,
    parentOKR?: string,
    parentKRIndex?: number
  ): Promise<OKRDocument> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check if team exists
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user has access to the team
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in the team or has required roles
    const isMember = team.members.some(member => member.userId === userId);
    const userRoles = user.roles
      .filter(role => role.company.toString() === team.companyId)
      .map(role => role.role);
    
    const hasRequiredRole = team.requiredRoles.some(role => userRoles.includes(role));
    
    if (!isMember && !hasRequiredRole) {
      throw new Error('User does not have access to this team');
    }

    // Create OKR
    const okr = new OKR({
      team: teamId,
      createdBy: userId,
      objective,
      description,
      deadline,
      keyResults: keyResults?.map(kr => ({
        title: kr.title,
        description: kr.description,
        metricType: kr.metricType,
        startValue: kr.startValue,
        targetValue: kr.targetValue,
        unit: kr.unit,
        actualValue: kr.startValue,
        progress: kr.metricType === 'percentage' ? 
          ((kr.startValue - kr.startValue) / (kr.targetValue - kr.startValue)) * 100 : 
          (kr.startValue / kr.targetValue) * 100
      })) || [],
      isFrozen: isFrozen || false,
      parentOKR: parentOKR ? new Types.ObjectId(parentOKR) : undefined,
      parentKRIndex
    });

    await okr.save();

    // Create OKRStats record
    const okrStats = new OKRStats({
      okr: okr._id,
      team: teamId,
      progress: okr.progress,
      keyResultsStats: okr.keyResults.map((kr, index) => ({
        index,
        title: kr.title,
        progress: kr.progress,
        actualValue: kr.actualValue,
        targetValue: kr.targetValue,
        metricType: kr.metricType,
        unit: kr.unit
      })),
      progressHistory: [{
        date: new Date(),
        value: okr.progress,
        keyResultsProgress: okr.keyResults.map((kr, index) => ({
          index,
          value: kr.progress
        }))
      }],
      status: 'on_track',
      isFrozen: okr.isFrozen,
      deadline: okr.deadline,
      parentOKR: parentOKR ? new Types.ObjectId(parentOKR) : undefined,
      parentKRIndex
    });

    await okrStats.save();

    return okr;
  }

  static async getTeamOKRs(teamId: string, userId: string): Promise<IOKR[]> {
    // Check if team exists
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user has access to the team
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is in the team or has required roles
    const isMember = team.members.some(member => member.userId === userId);
    const userRoles = user.roles
      .filter(role => role.company.toString() === team.companyId)
      .map(role => role.role);
    
    const hasRequiredRole = team.requiredRoles.some(role => userRoles.includes(role));
    
    if (!isMember && !hasRequiredRole) {
      throw new Error('User does not have access to this team');
    }

    // Get all OKRs for the team
    const okrs = await OKR.find({ team: teamId })
      .sort({ createdAt: -1 });

    return okrs;
  }

  static async addKeyResult(
    okrId: string, 
    title: string, 
    description?: string,
    metricType: 'number' | 'percentage' | 'currency' | 'custom' = 'number',
    startValue: number = 0,
    targetValue: number = 100,
    unit?: string
  ): Promise<IOKR> {
    try {
      if (!okrId) {
        throw new Error('OKR ID is required');
      }

      if (!title) {
        throw new Error('Title is required');
      }

      const okr = await OKR.findById(new Types.ObjectId(okrId));
      if (!okr) {
        throw new Error('OKR not found');
      }

      const newKeyResult = {
        title,
        description,
        metricType,
        startValue,
        targetValue,
        unit,
        actualValue: startValue,
        progress: 0
      };

      okr.keyResults.push(newKeyResult);
      
      try {
        await okr.save();
        console.log(`Successfully added key result to OKR ${okrId}`);
        return okr;
      } catch (saveError) {
        console.error('Error saving OKR:', saveError);
        throw new Error('Failed to save key result');
      }
    } catch (error) {
      console.error('Error in addKeyResult:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while adding key result');
    }
  }

  static async updateOKRFreezeStatus(okrId: string, isFrozen: boolean): Promise<IOKR> {
    try {
      if (!okrId) {
        throw new Error('OKR ID is required');
      }

      const okr = await OKR.findById(new Types.ObjectId(okrId));
      if (!okr) {
        throw new Error('OKR not found');
      }

      // Check if user has permission to update this OKR
      const user = await User.findById(okr.createdBy);
      if (!user) {
        throw new Error('User not found');
      }

      // Update freeze status
      okr.isFrozen = isFrozen;
      await okr.save();

      return okr;
    } catch (error) {
      console.error('Error in updateOKRFreezeStatus:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while updating OKR freeze status');
    }
  }

  static async getOKRById(okrId: string): Promise<IOKR> {
    try {
      if (!okrId) {
        throw new Error('OKR ID is required');
      }

      const okr = await OKR.findById(new Types.ObjectId(okrId));
      if (!okr) {
        throw new Error('OKR not found');
      }

      return okr;
    } catch (error) {
      console.error('Error in getOKRById:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred while getting OKR');
    }
  }
}

export default OKRService; 