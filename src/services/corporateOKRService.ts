import { Types, Document } from 'mongoose';
import { CorporateOKR } from '../models/CorporateOKR';
import { OKR } from '../models/OKR';
import { User } from '../models/User';
import { Company } from '../models/Company';
import Team from '../models/Team';
import { recalculateKRProgress } from '../models/CorporateOKR';

interface CorporateKR {
  title: string;
  description?: string;
  progress: number;
  teams: Types.ObjectId[];
}

interface CorporateOKRDocument extends Document {
  company: Types.ObjectId;
  createdBy: Types.ObjectId;
  objective: string;
  description?: string;
  keyResults: CorporateKR[];
  progress: number;
  status: 'draft' | 'active' | 'done';
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

interface PopulatedTeam {
  _id: Types.ObjectId;
  name: string;
}

interface PopulatedCorporateKR {
  title: string;
  description?: string;
  progress: number;
  teams: PopulatedTeam[];
}

class CorporateOKRService {
  static async createCorporateOKR(
    companyId: string,
    userId: string,
    objective: string,
    description: string,
    keyResults: Array<{ title: string, description?: string, teams?: string[] }>
  ) {
    // Проверяем существование компании
    const company = await Company.findById(new Types.ObjectId(companyId));
    if (!company) {
      throw new Error('Company not found');
    }

    // Проверяем права пользователя
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Проверяем, является ли пользователь создателем компании
    if (company.createdBy.toString() !== userId) {
      throw new Error('Only company creator can create corporate OKRs');
    }

    // Создаем корпоративный OKR
    const corporateOKR = new CorporateOKR({
      company: companyId,
      createdBy: userId,
      objective,
      description,
      keyResults: keyResults.map(kr => ({
        title: kr.title,
        description: kr.description,
        teams: kr.teams?.map(id => new Types.ObjectId(id)) || []
      }))
    });

    await corporateOKR.save();
    return corporateOKR;
  }

  static async assignTeamsToKR(
    corporateOKRId: string,
    krIndex: number,
    teamIds: string[],
    userId: string
  ) {
    const corporateOKR = await CorporateOKR.findById(new Types.ObjectId(corporateOKRId));
    if (!corporateOKR) {
      throw new Error('Corporate OKR not found');
    }

    // Проверяем права пользователя
    const company = await Company.findById(corporateOKR.company);
    if (!company || company.createdBy.toString() !== userId) {
      throw new Error('Only company creator can assign teams to KRs');
    }

    // Проверяем существование команд
    const teams = await Team.find({ _id: { $in: teamIds } });
    if (teams.length !== teamIds.length) {
      throw new Error('Some teams not found');
    }

    // Проверяем, что все команды принадлежат той же компании
    const invalidTeam = teams.find(team => team.companyId.toString() !== corporateOKR.company.toString());
    if (invalidTeam) {
      throw new Error('Some teams do not belong to this company');
    }

    // Обновляем список команд для KR
    if (!corporateOKR.keyResults[krIndex]) {
      throw new Error('Key Result not found');
    }

    // Используем $set для обновления массива teams
    await CorporateOKR.updateOne(
      { _id: corporateOKRId },
      { $set: { [`keyResults.${krIndex}.teams`]: teamIds.map(id => new Types.ObjectId(id)) } }
    );

    // Получаем обновленный документ
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

    // Проверяем, что команда назначена на этот KR
    const teamId = teamOKR.team.toString();
    const assignedTeams = corporateOKR.keyResults[krIndex].teams.map(id => id.toString());
    if (!assignedTeams.includes(teamId)) {
      throw new Error('Team is not assigned to this Key Result');
    }

    // Связываем OKR
    await OKR.updateOne(
      { _id: teamOKRId },
      { 
        $set: { 
          parentOKR: new Types.ObjectId(corporateOKRId),
          parentKRIndex: krIndex
        }
      }
    );

    // Получаем обновленный документ
    const updatedTeamOKR = await OKR.findById(teamOKRId);
    if (!updatedTeamOKR) {
      throw new Error('Failed to update team OKR');
    }

    // Пересчитываем прогресс KR
    await recalculateKRProgress(krIndex, new Types.ObjectId(corporateOKRId));

    return updatedTeamOKR;
  }

  static async getCorporateOKRs(companyId: string, userId: string) {
    const company = await Company.findById(new Types.ObjectId(companyId));
    if (!company) {
      throw new Error('Company not found');
    }

    // Проверяем права пользователя
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    const isCompanyCreator = company.createdBy.toString() === userId;
    const isTeamMember = await Team.exists({
      companyId,
      'members.userId': userId
    });

    if (!isCompanyCreator && !isTeamMember) {
      throw new Error('User does not have access to this company');
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

    // Проверяем права пользователя
    const company = await Company.findById(corporateOKR.company);
    if (!company) {
      throw new Error('Company not found');
    }

    const isCompanyCreator = company.createdBy.toString() === userId;
    const isTeamMember = await Team.exists({
      companyId: corporateOKR.company,
      'members.userId': userId
    });

    if (!isCompanyCreator && !isTeamMember) {
      throw new Error('User does not have access to this company');
    }

    const teamOKRs = await OKR.find({
      parentOKR: corporateOKRId,
      parentKRIndex: krIndex
    }).populate('team', 'name');

    return teamOKRs;
  }

  static async getKeyResultsAssignedToTeam(teamId: string, userId: string) {
    // Проверяем существование команды
    const team = await Team.findById(new Types.ObjectId(teamId));
    if (!team) {
      throw new Error('Team not found');
    }

    // Проверяем права пользователя
    const user = await User.findById(new Types.ObjectId(userId));
    if (!user) {
      throw new Error('User not found');
    }

    // Проверяем, является ли пользователь участником команды
    const isMember = team.members.some(member => member.userId.toString() === userId);
    if (!isMember) {
      throw new Error('User does not have access to this team');
    }

    // Находим все корпоративные OKR, где команда назначена на KR
    const corporateOKRs = await CorporateOKR.find({
      'keyResults.teams': teamId
    }).populate('company', 'name');

    // Формируем список KR, назначенных на команду
    const assignedKeyResults = corporateOKRs.flatMap(corporateOKR => 
      corporateOKR.keyResults
        .map((kr, index) => ({
          ...kr.toObject(),
          corporateOKRId: corporateOKR._id,
          corporateOKR: {
            _id: corporateOKR._id,
            objective: corporateOKR.objective,
            company: corporateOKR.company
          },
          krIndex: index
        }))
        .filter(kr => kr.teams.some(t => t.toString() === teamId))
    );

    return assignedKeyResults;
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

    // Получаем все OKR, привязанные к этому KR
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
        _id: okr._id,
        objective: okr.objective,
        progress: okr.progress,
        team: {
          _id: okr.team._id,
          name: okr.team.name
        }
      }))
    };
  }
}

export default CorporateOKRService; 