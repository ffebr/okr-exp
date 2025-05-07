import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

interface IUserRole {
  company: Types.ObjectId;
  role: string;
}

interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  roles: IUserRole[];
  companies: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserRoleSchema = new Schema<IUserRole>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  role: { type: String, required: true }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: [UserRoleSchema],
  companies: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = model<IUser>('User', UserSchema); 