import { CheckIn } from '../models/CheckIn';
import { OKR } from '../models/OKR';
import { Types } from 'mongoose';
import { recalculateKRProgress } from '../models/CorporateOKR';

class CheckInService {
  async createCheckIn(okrId: string, userId: string, updates: Array<{ index: number; newProgress: number }>, comment?: string) {
    // Convert string IDs to ObjectId
    const okrObjectId = new Types.ObjectId(okrId);
    const userObjectId = new Types.ObjectId(userId);

    // Get the OKR to validate updates
    const okr = await OKR.findById(okrObjectId);
    if (!okr) {
      throw new Error('OKR not found');
    }

    // Validate each update
    for (const update of updates) {
      if (typeof update.index !== 'number' || update.index < 0 || update.index >= okr.keyResults.length) {
        throw new Error('Invalid key result index');
      }
      if (typeof update.newProgress !== 'number' || update.newProgress < 0 || update.newProgress > 100) {
        throw new Error('Invalid progress value');
      }
    }

    // Create check-in record
    const checkIn = new CheckIn({
      okr: okrObjectId,
      user: userObjectId,
      comment,
      updates: updates.map(update => ({
        index: update.index,
        previousProgress: okr.keyResults[update.index].progress,
        newProgress: update.newProgress
      }))
    });

    // Update OKR key results
    for (const update of updates) {
      okr.keyResults[update.index].progress = update.newProgress;
    }

    // Save both check-in and OKR in a transaction
    await Promise.all([
      checkIn.save(),
      okr.save()
    ]);

    // If this OKR is linked to a corporate OKR, recalculate its progress
    if (okr.parentOKR && okr.parentKRIndex !== undefined) {
      await recalculateKRProgress(okr.parentKRIndex, okr.parentOKR);
    }

    return checkIn;
  }

  async getCheckIns(okrId: string) {
    const okrObjectId = new Types.ObjectId(okrId);
    return CheckIn.find({ okr: okrObjectId }).sort({ createdAt: -1 });
  }
}

export default new CheckInService(); 