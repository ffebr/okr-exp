import { Schema, model, Types } from 'mongoose';

const KeyResultUpdateSchema = new Schema({
  index: { type: Number, required: true }, // индекс ключевого результата в массиве OKR.keyResults
  previousProgress: { type: Number, required: true },
  newProgress: { type: Number, required: true }
}, { _id: false });

const CheckInSchema = new Schema({
  okr: { type: Types.ObjectId, ref: 'OKR', required: true },
  user: { type: Types.ObjectId, ref: 'User', required: true },
  comment: { type: String },
  date: { type: Date, default: Date.now },

  updates: [KeyResultUpdateSchema]
}, { timestamps: true });

export const CheckIn = model('CheckIn', CheckInSchema);
