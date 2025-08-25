const Offer = require('../models/offer');
const WhatsAppCommunication = require('../models/whatsappcommunication');
const { Hr } = require('../models/hrSchema');
const Candidate = require('../models/candidate');


// Dashboard analytics service for logged-in HR
 
const DashboardService = {
  async getDashboardData(hrId) {
    // 1. Offer Metrics
    const totalOffers = await Offer.countDocuments({ hrId });
    const activeOffers = await Offer.countDocuments({ hrId, status: 'ACTIVE' });
    const acceptedOffers = await Offer.countDocuments({ hrId, status: 'ACCEPTED' });
    const successRate = totalOffers ? Math.round((acceptedOffers / totalOffers) * 100) : 0;

    // Average hiring time (in days)
    const accepted = await Offer.find({ hrId, status: 'ACCEPTED' }, 'createdAt updatedAt');
    let averageHiringTime = 0;
    if (accepted.length) {
      const totalDays = accepted.reduce((sum, offer) => {
        const created = offer.createdAt;
        const acceptedDate = offer.updatedAt;
        return sum + ((acceptedDate - created) / (1000 * 60 * 60 * 24));
      }, 0);
      averageHiringTime = Math.round(totalDays / accepted.length);
    }

    // 2. WhatsApp Metrics
    const totalCommunications = await WhatsAppCommunication.countDocuments({
      $or: [{ initiatorHrId: hrId }, { recipientHrId: hrId }],
    });
    // Average response time (in minutes)
    const comms = await WhatsAppCommunication.find({
      $or: [{ initiatorHrId: hrId }, { recipientHrId: hrId }],
      'metrics.respondedAt': { $exists: true },
      'metrics.generatedAt': { $exists: true },
    }, 'metrics.generatedAt metrics.respondedAt status outcome');
    let avgResponseTime = 0;
    if (comms.length) {
      const totalMinutes = comms.reduce((sum, c) => {
        return sum + ((c.metrics.respondedAt - c.metrics.generatedAt) / (1000 * 60));
      }, 0);
      avgResponseTime = Math.round(totalMinutes / comms.length);
    }
    // Resolution rate
    const resolvedCount = await WhatsAppCommunication.countDocuments({
      $or: [{ initiatorHrId: hrId }, { recipientHrId: hrId }],
      status: 'RESOLVED',
    });
    const resolutionRate = totalCommunications ? Math.round((resolvedCount / totalCommunications) * 100) : 0;
    // Collaboration success rate (example: resolved with positive outcome)
    const collaborationSuccessRate = totalCommunications ? Math.round((await WhatsAppCommunication.countDocuments({
      $or: [{ initiatorHrId: hrId }, { recipientHrId: hrId }],
      status: 'RESOLVED',
      'outcome.result': { $in: ['TIMELINE_AGREED', 'SALARY_ADJUSTED'] },
    }) / totalCommunications) * 100) : 0;

    // 3. Trends (offers per day this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const offersThisMonth = await Offer.aggregate([
      { $match: { hrId, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);
    const offersThisMonthFormatted = offersThisMonth.map(o => ({ date: o._id, count: o.count }));

    // 4. Recent Activity (latest event per candidate, all types)
    const recentOffers = await Offer.find({ hrId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('candidateId', 'name');

    const recentComms = await WhatsAppCommunication.find({
      $or: [{ initiatorHrId: hrId }, { recipientHrId: hrId }],
      status: 'RESOLVED',
    })
      .sort({ 'metrics.resolvedAt': -1 })
      .limit(20)
      .populate('candidateId', 'name')
      .populate('initiatorHrId', 'name')
      .populate('recipientHrId', 'name');

    const recentAccepted = await Offer.find({ hrId, status: 'ACCEPTED' })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('candidateId', 'name');

    // Build full activity feed (all events, all types, all candidates)
    const fullActivityFeed = [];

    recentOffers.forEach(o => {
      if (!o.candidateId || !o.candidateId.name) return;
      fullActivityFeed.push({
        candidateId: o.candidateId._id.toString(),
        type: 'OFFER_CREATED',
        message: `Created offer for ${o.candidateId.name}`,
        timestamp: o.createdAt,
      });
    });

    recentComms.forEach(c => {
      if (!c.candidateId || !c.candidateId.name) return;
      const isInitiator = c.initiatorHrId._id.toString() === hrId;
      const otherHr = isInitiator ? c.recipientHrId : c.initiatorHrId;
      fullActivityFeed.push({
        candidateId: c.candidateId._id.toString(),
        type: 'WHATSAPP_RESOLVED',
        message: `Resolved communication with ${otherHr?.name || 'HR'}`,
        timestamp: c.metrics.resolvedAt,
      });
    });

    recentAccepted.forEach(a => {
      if (!a.candidateId || !a.candidateId.name) return;
      fullActivityFeed.push({
        candidateId: a.candidateId._id.toString(),
        type: 'CANDIDATE_ACCEPTED',
        message: `${a.candidateId.name} accepted your offer`,
        timestamp: a.updatedAt,
      });
    });

    // Sort full activity feed by timestamp descending
    fullActivityFeed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Build recent activity, only latest per candidate (all types)
    const activityMap = new Map();
    fullActivityFeed.forEach(event => {
      const existing = activityMap.get(event.candidateId);
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        activityMap.set(event.candidateId, event);
      }
    });
    const recentActivityLimited = Array.from(activityMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    // Final dashboard data
    return {
      overview: {
        totalOffers,
        activeOffers,
        acceptedOffers,
        successRate,
        averageHiringTime,
      },
      whatsappMetrics: {
        totalCommunications,
        averageResponseTime: avgResponseTime,
        resolutionRate,
        collaborationSuccessRate,
      },
      trends: {
        offersThisMonth: offersThisMonthFormatted,
      },
      recentActivity: recentActivityLimited, // summary: latest per candidate
      fullActivityFeed, // full chronological history
    };
  },


    // Public dashboard for all users
  async getPublicDashboardData() {
    // Company-wide metrics
    const totalOffers = await Offer.countDocuments();
    const activeOffers = await Offer.countDocuments({ status: 'ACTIVE' });
    const acceptedOffers = await Offer.countDocuments({ status: 'ACCEPTED' });
    const successRate = totalOffers ? Math.round((acceptedOffers / totalOffers) * 100) : 0;

    // Average hiring time (all offers)
    const accepted = await Offer.find({ status: 'ACCEPTED' }, 'createdAt updatedAt');
    let averageHiringTime = 0;
    if (accepted.length) {
      const totalDays = accepted.reduce((sum, offer) => {
        const created = offer.createdAt;
        const acceptedDate = offer.updatedAt;
        return sum + ((acceptedDate - created) / (1000 * 60 * 60 * 24));
      }, 0);
      averageHiringTime = Math.round(totalDays / accepted.length);
    }

    // WhatsApp metrics (all HRs)
    const totalCommunications = await WhatsAppCommunication.countDocuments();
    const comms = await WhatsAppCommunication.find({
      'metrics.respondedAt': { $exists: true },
      'metrics.generatedAt': { $exists: true },
    }, 'metrics.generatedAt metrics.respondedAt status outcome');
    let avgResponseTime = 0;
    if (comms.length) {
      const totalMinutes = comms.reduce((sum, c) => {
        return sum + ((c.metrics.respondedAt - c.metrics.generatedAt) / (1000 * 60));
      }, 0);
      avgResponseTime = Math.round(totalMinutes / comms.length);
    }
    const resolvedCount = await WhatsAppCommunication.countDocuments({ status: 'RESOLVED' });
    const resolutionRate = totalCommunications ? Math.round((resolvedCount / totalCommunications) * 100) : 0;
    const collaborationSuccessRate = totalCommunications ? Math.round((await WhatsAppCommunication.countDocuments({
      status: 'RESOLVED',
      'outcome.result': { $in: ['TIMELINE_AGREED', 'SALARY_ADJUSTED'] },
    }) / totalCommunications) * 100) : 0;

    // Trends (offers per day this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const offersThisMonth = await Offer.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);
    const offersThisMonthFormatted = offersThisMonth.map(o => ({ date: o._id, count: o.count }));

    // Recent Activity (latest event per candidate, all types, company-wide)
    const recentOffers = await Offer.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('candidateId', 'name');
      console.log('recentOffers', recentOffers);
    const recentComms = await WhatsAppCommunication.find({ status: 'RESOLVED' })
      .sort({ 'metrics.resolvedAt': -1 })
      .limit(10)
      .populate('candidateId', 'name')
      .populate('initiatorHrId', 'name')
      .populate('recipientHrId', 'name');
    const recentAccepted = await Offer.find({ status: 'ACCEPTED' })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('candidateId', 'name');

    // Build recent activity, only latest per candidate (all types)
    const activityMap = new Map();

    // Add OFFER_CREATED
    recentOffers.forEach(o => {
      if (!o.candidateId || !o.candidateId.name) return;
      const key = o.candidateId._id.toString();
      const event = {
        type: 'OFFER_CREATED',
        message: `Created offer for ${o.candidateId.name}`,
        timestamp: o.createdAt,
      };
      const existing = activityMap.get(key);
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        activityMap.set(key, event);
      }
    });

    // Add WHATSAPP_RESOLVED
    recentComms.forEach(c => {
      if (!c.candidateId || !c.candidateId.name) return;
      const key = c.candidateId._id.toString();
      const isInitiator = c.initiatorHrId && c.initiatorHrId._id && c.initiatorHrId._id.toString() === (c.initiatorHrId?._id?.toString() || '');
      const otherHr = isInitiator ? c.recipientHrId : c.initiatorHrId;
      const event = {
        type: 'WHATSAPP_RESOLVED',
        message: `Resolved communication with ${otherHr?.name || 'HR'}`,
        timestamp: c.metrics.resolvedAt,
      };
      const existing = activityMap.get(key);
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        activityMap.set(key, event);
      }
    });

    // Add CANDIDATE_ACCEPTEDs
    recentAccepted.forEach(a => {
      if (!a.candidateId || !a.candidateId.name) return;
      const key = a.candidateId._id.toString();
      const event = {
        type: 'CANDIDATE_ACCEPTED',
        message: `${a.candidateId.name} accepted an offer`,
        timestamp: a.updatedAt,
      };
      const existing = activityMap.get(key);
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        activityMap.set(key, event);
      }
    });

    // Get latest 5 activities by timestamp
    const recentActivityLimited = Array.from(activityMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    return {
      overview: {
        totalOffers,
        activeOffers,
        acceptedOffers,
        successRate,
        averageHiringTime,
      },
      whatsappMetrics: {
        totalCommunications,
        averageResponseTime: avgResponseTime,
        resolutionRate,
        collaborationSuccessRate,
      },
      trends: {
        offersThisMonth: offersThisMonthFormatted,
      },
      recentActivity: recentActivityLimited,
    };
  },



};

module.exports = DashboardService;
