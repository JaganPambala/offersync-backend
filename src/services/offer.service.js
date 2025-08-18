const Offer = require('../models/offer');
const Candidate = require('../models/candidate');
const { Hr } = require('../models/hrSchema');
const EmailService = require('./email.service');

class OfferService {
  static async createOffer(payload, hrId) {
    const {
      candidateId,
      position,
      compensation,
      timeline,
      priority,
      tags
    } = payload;

    // Basic existence checks
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    // Calculate competition before creating offer
    const competitionInfo = await this.calculateCompetition(candidateId);

    const offer = new Offer({
      candidateId,
      hrId,
      position,
      compensation,
      timeline,
      status: 'ACTIVE',
      priority: priority || 'MEDIUM',
      competition: competitionInfo,
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

  // New method to calculate competition
  static async calculateCompetition(candidateId, currentOfferId = null) {
    // Find all active offers for this candidate
    const activeOffers = await Offer.find({
      candidateId,
      status: 'ACTIVE',
      _id: { $ne: currentOfferId } // Exclude current offer if updating
    });

    const competitorCount = activeOffers.length;
    
    // Determine market rank based on competitor count
    let marketRank = 'LEADING';
    if (competitorCount > 2) {
      marketRank = 'BELOW_MARKET';
    } else if (competitorCount > 0) {
      marketRank = 'COMPETITIVE';
    }

    return {
      isCompetitive: competitorCount > 0,
      competitorCount,
      marketRank,
      collaborationNeeded: competitorCount > 0
    };
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

    // First, get all unique candidates with offers
    const uniqueCandidates = await Offer.distinct('candidateId', query);
    const total = uniqueCandidates.length;
    
    const skip = (page - 1) * limit;
    const paginatedCandidates = uniqueCandidates.slice(skip, skip + limit);

    // Get candidates with their offers
    const candidatesWithOffers = await Promise.all(
      paginatedCandidates.map(async (candidateId) => {
        // Get candidate details
        const candidate = await Candidate.findById(candidateId).select('name status');
        
        // Get all offers for this candidate
        const offers = await Offer.find({ 
          candidateId,
          ...query 
        }).select('position compensation status priority timeline');

        // Format offers according to the new structure
        const formattedOffers = offers.map(offer => ({
          id: offer._id,
          position: {
            title: offer.position.title,
            level: offer.position.level
          },
          compensation: {
            total: offer.compensation.total || 
                   (offer.compensation.base + 
                    (offer.compensation.variable || 0) + 
                    (offer.compensation.bonus || 0))
          },
          status: offer.status,
          priority: offer.priority,
          timeline: {
            validTill: offer.timeline.validTill,
            followUpDate: offer.timeline.followUpDate
          }
        }));

        // Return formatted candidate with offers
        return {
          candidate: {
            id: candidate._id,
            name: candidate.name,
            status: candidate.status
          },
          offers: formattedOffers
        };
      })
    );

    return {
      data: candidatesWithOffers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
}

  static async getOfferDetails(candidateId) {
    const offers = await Offer.find({ candidateId })
      .populate('candidateId', 'name status')
      .sort({ 'compensation.total': -1, priority: 1 })
      .exec();

    if (!offers.length) {
      throw new Error('No offers found for this candidate');
    }

    const competitorCount = offers.filter(o => o.status === 'ACTIVE').length - 1;

    return {
      candidate: {
        id: offers[0].candidateId._id,
        name: offers[0].candidateId.name,
        status: competitorCount > 0 ? 'MULTIPLE_OFFERS' : 
                offers[0].status === 'ACCEPTED' ? 'ACCEPTED' : 'AVAILABLE',
        offers: offers.map(offer => ({
          id: offer._id,
          position: {
            title: offer.position.title,
            level: offer.position.level
          },
          compensation: {
            total: offer.compensation.total
          },
          status: offer.status,
          priority: offer.priority,
          timeline: {
            validTill: offer.timeline.validTill,
            followUpDate: offer.timeline.followUpDate
          },
          createdAt: offer.createdAt
        }))
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

  // Update the updateStatus method to handle timeline updates
  static async updateStatus(offerId, status, timelineData = {}) {
    const allowed = ['DRAFT', 'ACTIVE', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'ON_HOLD', 'JOINED'];
    if (!allowed.includes(status)) {
      const readable = allowed.join(', ');
      const error = new Error(`Invalid status. Allowed: ${readable}`);
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const offer = await Offer.findById(offerId)
      .populate('candidateId')
      .populate('hrId');
      
    if (!offer) throw new Error('Offer not found');

    // Handle ACCEPTED status specially
    if (status === 'ACCEPTED') {
      // Update candidate status to ACCEPTED
      await Candidate.findByIdAndUpdate(
        offer.candidateId._id,
        { 
          status: 'ACCEPTED',
          $inc: { 'metrics.acceptedOffers': 1 },
          $push: {
            statusHistory: {
              from: offer.candidateId.status,
              to: 'ACCEPTED',
              timestamp: new Date(),
              reason: `Offer ${offerId} accepted`
            }
          }
        }
      );

      // Find other active offers and their HRs
      const otherOffers = await Offer.find({
        candidateId: offer.candidateId._id,
        _id: { $ne: offerId },
        status: 'ACTIVE'
      }).populate('hrId');

      // Set other offers to ON_HOLD and notify their HRs
      for (const otherOffer of otherOffers) {
        // Update offer status
        await Offer.findByIdAndUpdate(
          otherOffer._id,
          {
            $set: { 
              status: 'ON_HOLD',
              updatedAt: new Date()
            },
            $push: {
              statusHistory: {
                previousStatus: 'ACTIVE',
                newStatus: 'ON_HOLD',
                reason: 'Another offer was accepted',
                updatedAt: new Date()
              }
            }
          }
        );

        // Send email notification to other HRs
        try {
          await EmailService.sendOfferStatusNotification(
            otherOffer.hrId,
            offer.candidateId,
            {
              position: offer.position,
              acceptedCompany: offer.hrId.company.name
            }
          );
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't throw error, continue with the process
        }
      }

      // Send confirmation email to the HR whose offer was accepted
      try {
        await EmailService.sendOfferAcceptedConfirmation(
          offer.hrId,
          offer.candidateId,
          offer
        );
      } catch (emailError) {
        console.error('Failed to send acceptance confirmation:', emailError);
        // Don't throw error, continue with the process
      }
    }

    // Recalculate competition for all offers of this candidate
    const competitionInfo = await this.calculateCompetition(offer.candidateId._id, offerId);
    
    // Prepare timeline updates if provided
    const timelineUpdates = {};
    if (timelineData.validTill) {
      timelineUpdates['timeline.validTill'] = new Date(timelineData.validTill);
    }
    if (timelineData.followUpDate) {
      timelineUpdates['timeline.followUpDate'] = new Date(timelineData.followUpDate);
    }

    const updated = await Offer.findByIdAndUpdate(
      offerId,
      { 
        $set: { 
          status,
          updatedAt: new Date(),
          competition: competitionInfo,
          ...timelineUpdates
        },
        $push: {
          statusHistory: {
            previousStatus: offer.status,
            newStatus: status,
            reason: status === 'ACCEPTED' ? 'Offer accepted by candidate' : 'Status updated',
            updatedAt: new Date(),
            timelineUpdated: Object.keys(timelineUpdates).length > 0
          }
        }
      },
      { new: true }
    );

    // Update competition for other active offers of this candidate
    await Offer.updateMany(
      { 
        candidateId: offer.candidateId._id, 
        _id: { $ne: offerId },
        status: 'ACTIVE'
      },
      { $set: { competition: competitionInfo } }
    );

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

  // Remove the ability to manually update competition
  static async updateCompetition(offerId, competitionUpdates) {
    throw new Error('Competition is automatically calculated and cannot be manually updated');
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
