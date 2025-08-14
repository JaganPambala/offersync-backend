const Offer = require('../models/offer');
const Candidate = require('../models/candidate');
const { Hr } = require('../models/hrSchema');

class OfferService {
  static async createOffer(payload, hrId) {
    const {
      candidateId,
      position,
      compensation,
      timeline,
      priority,
      competition,
      tags
    } = payload;

    // Basic existence checks
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const offer = new Offer({
      candidateId,
      hrId,
      position,
      compensation,
      timeline,
      status: 'ACTIVE',
      priority: priority || 'MEDIUM',
      competition: competition || undefined,
      tags
    });

    const saved = await offer.save();

    // Update HR stats
    await Hr.findByIdAndUpdate(hrId, {
      $inc: { 'stats.totalOffersCreated': 1 },
      $set: { 'stats.lastActiveAt': new Date() }
    });

    return saved;
  }

  static async getOfferById(offerId) {
    const offer = await Offer.findById(offerId)
      .populate('candidateId', 'name email phone profile location status')
      .populate('hrId', 'name company.name whatsapp.phoneNumber');
    if (!offer) throw new Error('Offer not found');
    return offer;
  }

  static async listOffers(filters = {}, page = 1, limit = 10) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.hrId) query.hrId = filters.hrId;
    if (filters.candidateId) query.candidateId = filters.candidateId;
    if (filters.search) {
      query.$or = [
        { 'position.title': { $regex: filters.search, $options: 'i' } },
        { tags: { $in: [filters.search] } }
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Offer.find(query)
        .populate('candidateId', 'name email phone')
        .populate('hrId', 'name company.name')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Offer.countDocuments(query)
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async updateOffer(offerId, updates) {
    const allowedTopLevel = ['position', 'compensation', 'timeline', 'priority', 'competition', 'tags'];
    const sanitized = {};
    for (const key of allowedTopLevel) {
      if (updates[key] !== undefined) sanitized[key] = updates[key];
    }

    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { $set: sanitized },
      { new: true }
    );
    if (!updated) throw new Error('Offer not found');
    return updated;
  }

  static async updateStatus(offerId, status) {
    const allowed = ['DRAFT', 'ACTIVE', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'ON_HOLD', 'JOINED'];
    if (!allowed.includes(status)) {
      const readable = allowed.join(', ');
      const error = new Error(`Invalid status. Allowed: ${readable}`);
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );
    if (!updated) throw new Error('Offer not found');
    return updated;
  }

  static async updateTimeline(offerId, timelineUpdates) {
    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { $set: Object.fromEntries(Object.entries(timelineUpdates).map(([k,v]) => [`timeline.${k}`, v])) },
      { new: true }
    );
    if (!updated) throw new Error('Offer not found');
    return updated;
  }

  static async updateCompetition(offerId, competitionUpdates) {
    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { $set: Object.fromEntries(Object.entries(competitionUpdates).map(([k,v]) => [`competition.${k}`, v])) },
      { new: true }
    );
    if (!updated) throw new Error('Offer not found');
    return updated;
  }

  static async incrementAnalytics(offerId, field) {
    const allowed = ['viewCount', 'updateCount', 'communicationCount'];
    if (!allowed.includes(field)) {
      const error = new Error(`Invalid analytics field. Allowed: ${allowed.join(', ')}`);
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { $inc: { [`analytics.${field}`]: 1 } },
      { new: true }
    );
    if (!updated) throw new Error('Offer not found');
    return updated;
  }

  static async removeOffer(offerId) {
    const deleted = await Offer.findByIdAndDelete(offerId);
    if (!deleted) throw new Error('Offer not found');
    return { success: true };
  }

  static async getSummary() {
    const [byStatus, totalActive, totalAccepted] = await Promise.all([
      Offer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Offer.countDocuments({ status: 'ACTIVE' }),
      Offer.countDocuments({ status: 'ACCEPTED' })
    ]);
    return { byStatus, totalActive, totalAccepted };
  }
}

module.exports = OfferService;
