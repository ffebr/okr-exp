import { model, Schema, Types } from "mongoose";

const CompanySchema = new Schema({
    name: { type: String, required: true },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
    roles: [{
      name: { type: String, required: true },
      description: String,
      permissions: {
        manageTeams: { type: Boolean, default: false },
        manageUsers: { type: Boolean, default: false },
        manageCompanyOKRs: { type: Boolean, default: false }
      }
    }]
  }, { timestamps: true });
  
  export const Company = model('Company', CompanySchema);
  