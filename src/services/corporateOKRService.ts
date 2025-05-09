import { Types, Document } from 'mongoose';
import { CorporateOKR, recalculateKRProgress, CorporateKR } from '../models/CorporateOKR';
import { OKR } from '../models/OKR';
import { User } from '../models/User';
import { Company } from '../models/Company';
import Team from '../models/Team';

interface CorporateKRInput {
  title: string;
  description?: string;
  metricType: 'number' | 'percentage' | 'currency' | 'custom';
  startValue: number;
  targetValue: number;
  unit?: string;
  teams?: string[];
}

interface CorporateOKRDocument extends Document {
  company: Types.ObjectId;
  createdBy: Types.ObjectId;
  objective: string;
  description?: string;
  deadline?: Date;
  isFrozen: boolean;
  keyResults: CorporateKR[];
  progress: number;
  status: 'draft' | 'active' | 'done';
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedTeam {
  _id: Types.ObjectId;
  name: string;
}

interface PopulatedCorporateKR {
  title: string;
  description?: string;
  metricType: 'number' | 'percentage' | 'currency' | 'duration' | 'custom';
  startValue: number;
  targetValue: number;
  unit?: string;
  actualValue: number;
  progress: number;
  teams: PopulatedTeam[];
}

interface CorporateKRDetails {
  keyResult: {
    title: string;
    description?: string;
    progress: number;
    teams: Array<{
      _id: Types.ObjectId;
      name: string;
    }>;
  };
  linkedOKRs: Array<{
    _id: Types.ObjectId;
    objective: string;
    progress: number;
    team: {
      _id: Types.ObjectId;
      name: string;
    };
  }>;
}

class CorporateOKRService {
  static async createCorporateOKR(
    companyId: string,
    userId: string,
    objective: string,
    description: string,
    keyResults: CorporateKRInput[],
    isFrozen?: boolean,
    deadline?: Date
  ): Promise<CorporateOKRDocument> {
    // Check if company exists
    const company = await Company.findById(new Types.ObjectId(companyId));
    if (!company) {
      throw new Error('Company not found');
    }

    // Create corporate OKR
    const corporateOKR = new CorporateOKR({
      company: companyId,
      createdBy: userId,
      objective,
      description,
      deadline,
      isFrozen: isFrozen || false,
      keyResults: keyResults.map(kr => ({
        title: kr.title,
        description: kr.description,
        metricType: kr.metricType,
        startValue: kr.startValue || 0,
        targetValue: kr.targetValue,
        unit: kr.unit || '',
        actualValue: kr.startValue || 0,
        progress: 0,
        teams: kr.teams?.map((id: string) => new Types.ObjectId(id)) || []
      }))
    });

    await corporateOKR.save();
    return corporateOKR;
  }

  static async updateOKRFreezeStatus(
    corporateOKRId: string,
    isFrozen: boolean,
    userId: string
  ): Promise<CorporateOKRDocument> {
    const corporateOKR = await CorporateOKR.findById(new Types.ObjectId(corporateOKRId));
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    // Update freeze status
    corporateOKR.isFrozen = isFrozen;
    await corporateOKR.save();

    // Update all linked team OKRs with the same freeze status
    await OKR.updateMany(
      { parentOKR: corporateOKRId },
      { $set: { isFrozen: isFrozen } }
    );

    return corporateOKR;
  }

  static async updateKeyResult(
    corporateOKRId: string,
    krIndex: number,
    updates: Partial<CorporateKRInput>,
    userId: string
  ): Promise<CorporateOKRDocument> {
    const corporateOKR = await CorporateOKR.findById(new Types.ObjectId(corporateOKRId));
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    // Check if OKR is frozen
    if (corporateOKR.isFrozen) {
      throw new Error('Cannot update a frozen OKR');
    }

    // Check user permissions
    const company = await Company.findById(corporateOKR.company);
    if (!company || company.createdBy.toString() !== userId) {
      throw new Error('Only company creator can update key results');
    }

    // Check if key result exists
    if (!corporateOKR.keyResults[krIndex]) {
      throw new Error('Key result not found');
    }

    // Update key result
    const updateFields: Record<string, any> = {};
    if (updates.title) updateFields[`keyResults.${krIndex}.title`] = updates.title;
    if (updates.description !== undefined) updateFields[`keyResults.${krIndex}.description`] = updates.description;
    if (updates.metricType) updateFields[`keyResults.${krIndex}.metricType`] = updates.metricType;
    if (updates.startValue !== undefined) updateFields[`keyResults.${krIndex}.startValue`] = updates.startValue;
    if (updates.targetValue !== undefined) updateFields[`keyResults.${krIndex}.targetValue`] = updates.targetValue;
    if (updates.unit !== undefined) updateFields[`keyResults.${krIndex}.unit`] = updates.unit;
    // Update teams if provided
    if (updates.teams) {
      updateFields[`keyResults.${krIndex}.teams`] = updates.teams.map(id => new Types.ObjectId(id));
    }

    await CorporateOKR.updateOne(
      { _id: corporateOKRId },
      { $set: updateFields }
    );

    // Get updated document
    const updatedCorporateOKR = await CorporateOKR.findById(corporateOKRId);
    if (!updatedCorporateOKR) {
      throw new Error('Failed to update corporate OKR');
    }

    return updatedCorporateOKR;
  }

  static async linkTeamOKRToCorporate(
    teamOKRId: string,
    corporateOKRId: string,
    krIndex: number,
    userId: string
  ) {
    const teamOKR = await OKR.findById(new Types.ObjectId(teamOKRId));
    if (!teamOKR) {
      throw new Error('Team OKR not found');
    }

    const corporateOKR = await CorporateOKR.findById(new Types.ObjectId(corporateOKRId));
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    // Check if corporate OKR is frozen
    if (corporateOKR.isFrozen) {
      throw new Error('Cannot link to a frozen corporate OKR');
    }

    // Проверяем права пользователя
    const team = await Team.findById(teamOKR.team);
    if (!team) {
      throw new Error('Team not found');
    }

    const isTeamCreator = team.createdBy.toString() === userId;
    const isOKRCreator = teamOKR.createdBy.toString() === userId;
    if (!isTeamCreator && !isOKRCreator) {
      throw new Error('Only team creator or OKR creator can link OKRs');
    }

    // Check if key result exists and has teams
    const keyResult = corporateOKR.keyResults[krIndex];
    if (!keyResult || !keyResult.teams) {
      throw new Error('Key result not found or has no teams assigned');
    }

    // Check if team is assigned to this KR
    const teamId = teamOKR.team.toString();
    const assignedTeams = keyResult.teams.map(id => id.toString());
    if (!assignedTeams.includes(teamId)) {
      throw new Error('Team is not assigned to this Key Result');
    }

    // Связываем OKR
    await OKR.updateOne(
      { _id: teamOKRId },
      { 
        $set: { 
          parentOKR: new Types.ObjectId(corporateOKRId),
          parentKRIndex: krIndex,
          isFrozen: corporateOKR.isFrozen // Inherit freeze status from corporate OKR
        }
      }
    );

    // Получаем обновленный документ
    const updatedTeamOKR = await OKR.findById(teamOKRId);
    if (!updatedTeamOKR) {
      throw new Error('Failed to update team OKR');
    }

    // Пересчитываем прогресс корпоративного KR
    await recalculateKRProgress(krIndex, new Types.ObjectId(corporateOKRId));

    return updatedTeamOKR;
  }

  static async getCorporateOKRs(companyId: string, userId: string) {
    const company = await Company.findById(new Types.ObjectId(companyId));
    if (!company) {
      throw new Error('Company not found');
    }

    const corporateOKRs = await CorporateOKR.find({ company: companyId })
      .sort({ createdAt: -1 });

    return corporateOKRs;
  }

  static async getTeamOKRsForCorporateKR(corporateOKRId: string, krIndex: number, userId: string) {
    const corporateOKR = await CorporateOKR.findById(new Types.ObjectId(corporateOKRId));
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    const teamOKRs = await OKR.find({
      parentOKR: corporateOKRId,
      parentKRIndex: krIndex
    }).populate('team', 'name');

    return teamOKRs;
  }

  static async getKeyResultsAssignedToTeam(teamId: string, userId: string) {
    try {
      // Find all corporate OKRs that have key results assigned to this team
      const corporateOKRs = await CorporateOKR.find({
        'keyResults.teams': new Types.ObjectId(teamId)
      }).populate({
        path: 'company',
        select: 'name'
      });

      if (!corporateOKRs.length) {
        return [];
      }

      // Map through corporate OKRs and their key results to find assigned ones
      const assignedKeyResults = corporateOKRs.flatMap(corporateOKR => {
        return corporateOKR.keyResults
          .filter(kr => kr.teams?.some(team => team.toString() === teamId))
          .map(kr => ({
            corporateOKRId: corporateOKR._id,
            companyName: (corporateOKR.company as any).name,
            objective: corporateOKR.objective,
            keyResult: {
              title: kr.title,
              description: kr.description,
              metricType: kr.metricType,
              startValue: kr.startValue,
              targetValue: kr.targetValue,
              unit: kr.unit,
              teams: kr.teams,
              progress: kr.progress
            }
          }));
      });

      return assignedKeyResults;
    } catch (error) {
      console.error('Error in getKeyResultsAssignedToTeam:', error);
      throw error;
    }
  }

  static async getCorporateKRDetails(
    okrId: string,
    krIndex: number,
    userId: string
  ): Promise<CorporateKRDetails> {
    const corporateOKR = await CorporateOKR.findById(okrId)
      .populate<{ keyResults: PopulatedCorporateKR[] }>('keyResults.teams', 'name') as CorporateOKRDocument | null;

    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    if (krIndex < 0 || krIndex >= corporateOKR.keyResults.length) {
      throw new Error('Key result not found');
    }

    const linkedOKRs = await OKR.find({
      parentOKR: okrId,
      parentKRIndex: krIndex
    }).populate<{ team: PopulatedTeam }>('team', 'name');

    const keyResult = corporateOKR.keyResults[krIndex] as unknown as PopulatedCorporateKR;

    return {
      keyResult: {
        title: keyResult.title,
        description: keyResult.description,
        progress: keyResult.progress,
        teams: keyResult.teams.map(team => ({
          _id: team._id,
          name: team.name
        }))
      },
      linkedOKRs: linkedOKRs.map(okr => ({
        _id: okr._id as Types.ObjectId,
        objective: okr.objective,
        progress: okr.progress,
        team: {
          _id: okr.team._id,
          name: okr.team.name
        }
      }))
    };
  }

  static async assignTeamsToKR(
    okrId: string,
    krIndex: number,
    teamIds: string[],
    userId: string
  ): Promise<CorporateOKRDocument> {
    const corporateOKR = await CorporateOKR.findById(okrId);
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    // Check if OKR is frozen
    if (corporateOKR.isFrozen) {
      throw new Error('Cannot modify teams for a frozen OKR');
    }

    if (krIndex < 0 || krIndex >= corporateOKR.keyResults.length) {
      throw new Error('Key result not found');
    }

    // Validate teams
    const teams = await Team.find({
      _id: { $in: teamIds.map((id: string) => new Types.ObjectId(id)) },
      companyId: corporateOKR.company // Ensure teams belong to the same company
    });

    if (teams.length !== teamIds.length) {
      throw new Error('One or more teams not found or do not belong to this company');
    }

    // Update teams for the key result
    corporateOKR.keyResults[krIndex].teams = teamIds.map((id: string) => new Types.ObjectId(id));
    await corporateOKR.save();

    return corporateOKR;
  }

  static async getCorporateOKRById(okrId: string, userId: string): Promise<CorporateOKRDocument | null> {
    const corporateOKR = await CorporateOKR.findById(okrId)
      .populate('company', 'name')
      .populate('createdBy', 'name')
      .populate<{ keyResults: PopulatedCorporateKR[] }>('keyResults.teams', 'name');

    if (!corporateOKR) {
      return null;
    }

    // Convert the populated document back to the expected type
    const result = corporateOKR.toObject();
    return {
      ...result,
      keyResults: result.keyResults.map((kr: any) => ({
        ...kr,
        teams: kr.teams.map((team: PopulatedTeam) => team._id)
      }))
    } as CorporateOKRDocument;
  }

  static async updateCorporateOKRProgress(
    okrId: string,
    krIndex: number,
    actualValue: number,
    userId: string
  ): Promise<CorporateOKRDocument> {
    const corporateOKR = await CorporateOKR.findById(okrId);
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    if (krIndex < 0 || krIndex >= corporateOKR.keyResults.length) {
      throw new Error('Key result not found');
    }

    const kr = corporateOKR.keyResults[krIndex];
    kr.actualValue = actualValue;
    
    // Calculate progress using the same logic as in the model
    const span = kr.targetValue - kr.startValue;
    const raw = span === 0 ? 100 : ((kr.actualValue - kr.startValue) / span) * 100;
    kr.progress = Math.min(100, Math.max(0, Math.round(raw)));

    corporateOKR.progress = corporateOKR.keyResults.reduce(
      (sum: number, kr: CorporateKR) => sum + kr.progress,
      0
    ) / corporateOKR.keyResults.length;

    await corporateOKR.save();
    return corporateOKR;
  }
}

export default CorporateOKRService; 