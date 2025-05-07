import { model, Schema, Types } from "mongoose";

const CompanySchema = new Schema({
    name: { type: String, required: true },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
  
    // Роли, определённые внутри этой компании
    roles: [{
      name: { type: String, required: true },
      description: String
    }]
  }, { timestamps: true });
  
  export const Company = model('Company', CompanySchema);
  