const Candidate = require('../models/candidate');
const Offer = require('../models/offer');
const { Hr } = require('../models/hrSchema');
const crypto = require('crypto');

class CandidateService {
 
  static hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static async checkDuplicates(candidateData) {
    try {
      const { pan, aadhaar, email, phone } = candidateData;
      
      // Hash the sensitive data for comparison
      const hashedPAN = this.hashData(pan);
      const hashedAadhaar = this.hashData(aadhaar);
      
      // Check for duplicates using multiple identifiers
      const duplicates = await Candidate.find({
        $or: [
          { hashedPAN: hashedPAN },
          { hashedAadhaar: hashedAadhaar },
          { email: email.toLowerCase() },
          { phone: phone }
        ]
      }).populate('source.addedBy', 'name company.name whatsapp.phoneNumber');
      console.log("duplicates---------",duplicates );

      if (duplicates.length === 0) {
        return {
          hasDuplicates: false,
          message: 'No duplicates found. Safe to proceed with offer.',
          data: null
        };
      }

      // Get existing offers for duplicate candidates
      const duplicateOffers = await Offer.find({
        candidateId: { $in: duplicates.map(d => d._id) },
        status: { $in: ['ACTIVE', 'ACCEPTED', 'ON_HOLD'] }
        
      }).populate('hrId', 'name company.name whatsapp.phoneNumber');

      console.log("duplicateOffers---------",duplicateOffers );

      // Group offers by candidate
      const candidatesWithOffers = duplicates.map(candidate => {
        const candidateOffers = duplicateOffers.filter(offer => 
          offer.candidateId.toString() === candidate._id.toString()
        );
        console.log("candidateOffers---------",candidateOffers );
        
        return {
          candidate: {
            id: candidate._id,  
            name: candidate.name,
            currentCompany: candidate.profile?.currentCompany,
            currentRole: candidate.profile?.currentRole,
            totalExperience: candidate.profile?.totalExperience,
            location: candidate.location,
            status: candidate.status,
            skills: candidate.profile?.skills,
          },
          metrics: candidate.metrics,
          existingOffers: candidateOffers.map(offer => ({
            id: offer._id,
            company: offer.company,
            position: offer.position,
            compensation: offer.compensation,
            status: offer.status,
            priority: offer.priority,
            timeline: offer.timeline,
            hr: {
              id: offer.hrId._id,
              name: offer.hrId.name,
              company: offer.hrId.company.name,
              whatsapp: offer.hrId.whatsapp.phoneNumber
            }
          })),
          hrContact: {
            id: candidate.source.addedBy._id,
            name: candidate.source.addedBy.name,
            company: candidate.source.addedBy.company.name,
            whatsapp: candidate.source.addedBy.whatsapp.phoneNumber
          }
        };
      });

      return {
        hasDuplicates: true,
        message: `Found ${duplicates.length} duplicate candidate(s) with existing offers.`,
        data: {
          duplicateCount: duplicates.length,
          candidates: candidatesWithOffers,
          recommendations: this.generateRecommendations(candidatesWithOffers)
        }
      };
    } catch (error) {
      throw new Error(`Error checking duplicates: ${error.message}`);
    }
  }

  /**
   * Generate AI-powered recommendations for conflict resolution
   */
  static generateRecommendations(candidatesWithOffers) {
    const recommendations = [];

    candidatesWithOffers.forEach(({ candidate, offers, hrContact }) => {
      const activeOffers = offers.filter(offer => offer.status === 'ACTIVE');
      const acceptedOffers = offers.filter(offer => offer.status === 'ACCEPTED');

      if (acceptedOffers.length > 0) {
        recommendations.push({
          type: 'WARNING',
          message: `Candidate ${candidate.name} has already accepted an offer. Consider this before proceeding.`,
          action: 'REVIEW_ACCEPTED_OFFER',
          priority: 'HIGH'
        });
      } else if (activeOffers.length > 0) {
        recommendations.push({
          type: 'INFO',
          message: `Candidate ${candidate.name} has ${activeOffers.length} active offer(s). Coordinate with other HRs.`,
          action: 'WHATSAPP_COORDINATION',
          priority: 'MEDIUM',
          hrContacts: [hrContact, ...activeOffers.map(o => o.hr)]
        });
      }

      // Check for competitive offers
      const competitiveOffers = offers.filter(offer => 
        offer.compensation && offer.compensation.total > 0
      );
      
      if (competitiveOffers.length > 0) {
        const avgCompensation = competitiveOffers.reduce((sum, offer) => 
          sum + offer.compensation.total, 0
        ) / competitiveOffers.length;
        
        recommendations.push({
          type: 'SUGGESTION',
          message: `Market average compensation for this role is ${avgCompensation.toLocaleString('en-IN')} ${competitiveOffers[0].compensation.currency}.`,
          action: 'COMPETITIVE_OFFER',
          priority: 'MEDIUM',
          data: { averageCompensation: avgCompensation }
        });
      }
    });

    return recommendations;
  }

  /**
   * Create candidate and offer in a single transaction
   */
  static async createCandidateWithOffer(candidateData, offerData, hrId) {
    try {
      const { pan, aadhaar, email, phone, name, location, profile, whatsappNumber, consent } = candidateData;
      
      // Hash sensitive data
      const hashedPAN = this.hashData(pan);
      const hashedAadhaar = this.hashData(aadhaar);
      
      // Create candidate
      const newCandidate = new Candidate({
        name,
        hashedPAN,
        hashedAadhaar,
        email: email.toLowerCase(),
        phone,
        location,
        profile,
        source: {
          addedBy: hrId,
          method: 'MANUAL'
        },
        status: 'OFFERED', // Set status to OFFERED since we're creating an offer
        metrics: {
          totalOffers: 1,
          activeOffers: 1,
          acceptedOffers: 0,
          totalCommunications: 0
        }
      });

      // Save candidate
      const savedCandidate = await newCandidate.save();
      
      // Create offer
      const newOffer = new Offer({
        candidateId: savedCandidate._id,
        hrId,
        position: offerData.position,
        compensation: offerData.compensation,
        timeline: offerData.timeline,
        status: 'ACTIVE',
        priority: offerData.priority || 'MEDIUM',
        competition: offerData.competition,
        tags: offerData.tags
      });

      // Save offer
      const savedOffer = await newOffer.save();

      // Update HR stats
      await Hr.findByIdAndUpdate(hrId, {
        $inc: { 
          'stats.totalOffersCreated': 1,
          'stats.totalCandidatesAdded': 1
        },
        $set: { 'stats.lastActiveAt': new Date() }
      });

      return {
        success: true,
        message: 'Candidate and offer created successfully',
        data: {
          candidate: {
            id: savedCandidate._id,
            name: savedCandidate.name,
            status: savedCandidate.status,
            createdAt: savedCandidate.createdAt
          },
          offer: {
            id: savedOffer._id,
            position: savedOffer.position,
            status: savedOffer.status,
            createdAt: savedOffer.createdAt
          }
        }
      };
    } catch (error) {
      throw new Error(`Error creating candidate with offer: ${error.message}`);
    }
  }

  /**
   * Create offer for existing candidate
   */
  static async createOfferForExistingCandidate(candidateId, offerData, hrId) {
    try {
      // Create offer
      const newOffer = new Offer({
        candidateId,
        hrId,
        position: offerData.position,
        compensation: offerData.compensation,
        timeline: offerData.timeline,
        status: 'ACTIVE',
        priority: offerData.priority || 'MEDIUM',
        competition: offerData.competition,
        tags: offerData.tags
      });

      // Save offer
      const savedOffer = await newOffer.save();

      // Update candidate status and metrics
      await Candidate.findByIdAndUpdate(candidateId, {
        $set: { status: 'OFFERED' },
        $inc: { 
          'metrics.totalOffers': 1,
          'metrics.activeOffers': 1
        }
      });

      // Update HR stats
      await Hr.findByIdAndUpdate(hrId, {
        $inc: { 'stats.totalOffersCreated': 1 },
        $set: { 'stats.lastActiveAt': new Date() }
      });

      return {
        success: true,
        message: 'Offer created successfully for existing candidate',
        data: {
          offer: {
            id: savedOffer._id,
            position: savedOffer.position,
            status: savedOffer.status,
            createdAt: savedOffer.createdAt
          },
          candidateId
        }
      };
    } catch (error) {
      throw new Error(`Error creating offer for existing candidate: ${error.message}`);
    }
  }

  /**
   * Get candidate details by ID
   */
  static async getCandidateById(candidateId) {
    try {
      const candidate = await Candidate.findById(candidateId)
        .populate('source.addedBy', 'name company.name whatsapp.phoneNumber')
        .populate('communications.withHrId', 'name company.name whatsapp.phoneNumber');

      if (!candidate) {
        throw new Error('Candidate not found');
      }

      return {
        success: true,
        data: candidate
      };
    } catch (error) {
      throw new Error(`Error fetching candidate: ${error.message}`);
    }
  }

  /**
   * Update candidate status and metrics
   */
  static async updateCandidateStatus(candidateId, newStatus, hrId) {
    try {
      const candidate = await Candidate.findById(candidateId);
      if (!candidate) {
        throw new Error('Candidate not found');
      }

      const oldStatus = candidate.status;
      candidate.status = newStatus;
      
      // Update metrics based on status change
      if (newStatus === 'OFFERED' && oldStatus !== 'OFFERED') {
        candidate.metrics.totalOffers += 1;
        candidate.metrics.activeOffers += 1;
      } else if (newStatus === 'ACCEPTED' && oldStatus !== 'ACCEPTED') {
        candidate.metrics.acceptedOffers += 1;
        candidate.metrics.activeOffers = Math.max(0, candidate.metrics.activeOffers - 1);
      }

      // Add communication record if HR is different
      if (hrId && candidate.source.addedBy.toString() !== hrId.toString()) {
        candidate.communications.push({
          withHrId: hrId,
          status: 'ACTIVE',
          startedAt: new Date()
        });
        candidate.metrics.totalCommunications += 1;
      }

      const updatedCandidate = await candidate.save();
      
      return {
        success: true,
        message: 'Candidate status updated successfully',
        data: {
          id: updatedCandidate._id,
          status: updatedCandidate.status,
          metrics: updatedCandidate.metrics
        }
      };
    } catch (error) {
      throw new Error(`Error updating candidate status: ${error.message}`);
    }
  }

  /**
   * Search candidates with filters
   */
  static async searchCandidates(filters, page = 1, limit = 10) {
    try {
      const query = {};
      
      // Apply filters
      if (filters.status) query.status = filters.status;
      if (filters.location) {
        query['location.city'] = { $regex: filters.location, $options: 'i' };
      }
      if (filters.experience) {
        query['profile.totalExperience'] = { $gte: filters.experience };
      }
      if (filters.skills && filters.skills.length > 0) {
        query['profile.skills'] = { $in: filters.skills };
      }

      const skip = (page - 1) * limit;
      
      const candidates = await Candidate.find(query)
        .populate('source.addedBy', 'name company.name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Candidate.countDocuments(query);

      return {
        success: true,
        data: {
          candidates,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      throw new Error(`Error searching candidates: ${error.message}`);
    }
  }

  /**
   * Get candidate analytics and metrics
   */
  static async getCandidateAnalytics() {
    try {
      const analytics = await Candidate.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgExperience: { $avg: '$profile.totalExperience' }
          }
        }
      ]);

      const totalCandidates = await Candidate.countDocuments();
      const totalOffers = await Offer.countDocuments({ status: 'ACTIVE' });
      const duplicateRate = await this.calculateDuplicateRate();

      return {
        success: true,
        data: {
          totalCandidates,
          totalOffers,
          duplicateRate,
          statusBreakdown: analytics,
          recentActivity: await this.getRecentActivity()
        }
      };
    } catch (error) {
      throw new Error(`Error fetching analytics: ${error.message}`);
    }
  }

  /**
   * Calculate duplicate rate based on communications
   */
  static async calculateDuplicateRate() {
    try {
      const totalCandidates = await Candidate.countDocuments();
      const candidatesWithCommunications = await Candidate.countDocuments({
        'communications.0': { $exists: true }
      });

      return totalCandidates > 0 ? (candidatesWithCommunications / totalCandidates) * 100 : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get recent candidate activity
   */
  static async getRecentActivity(limit = 10) {
    try {
      return await Candidate.find()
        .populate('source.addedBy', 'name company.name')
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('name status updatedAt source.addedBy');
    } catch (error) {
      return [];
    }
  }
}

module.exports = CandidateService;
