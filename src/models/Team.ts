import mongoose from 'mongoose';

interface ITeamMember {
  userId: string;
}

interface ITeam {
  name: string;
  companyId: string;
  createdBy: string;
  members: ITeamMember[];
  requiredRoles: string[];
  createdAt: Date;
  updatedAt: Date;
  addMember(userId: string): ITeam;
  removeMember(userId: string): ITeam;
  addRequiredRole(roleName: string): ITeam;
  removeRequiredRole(roleName: string): ITeam;
}

const teamSchema = new mongoose.Schema<ITeam>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  createdBy: {
    type: String,
    required: true,
    ref: 'User'
  },
  members: [{
    userId: {
      type: String,
      required: true,
      ref: 'User'
    }
  }],
  requiredRoles: [{
    type: String,
    required: true
  }]
}, {
  timestamps: true
});

// Indexes
teamSchema.index({ companyId: 1 });
teamSchema.index({ 'members.userId': 1 });
teamSchema.index({ requiredRoles: 1 });

// Methods
teamSchema.methods.addMember = function(userId: string) {
  if (!this.members.some((member: ITeamMember) => member.userId === userId)) {
    this.members.push({ userId });
  }
  return this;
};

teamSchema.methods.removeMember = function(userId: string) {
  this.members = this.members.filter((member: ITeamMember & { _id?: any }) => {
    const memberId = member._id ? member._id.toString() : member.userId;
    return memberId !== userId;
  });
  return this;
};

teamSchema.methods.addRequiredRole = function(roleName: string) {
  if (!this.requiredRoles.includes(roleName)) {
    this.requiredRoles.push(roleName);
  }
  return this;
};

teamSchema.methods.removeRequiredRole = function(roleName: string) {
  this.requiredRoles = this.requiredRoles.filter((role: string) => role !== roleName);
  return this;
};

const Team = mongoose.model<ITeam>('Team', teamSchema);

export default Team;
  