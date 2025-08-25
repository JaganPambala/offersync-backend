// services/offer.service.js
const mongoose = require("mongoose");
const Offer = require("../models/offer");
const Candidate = require("../models/candidate");
const { Hr } = require("../models/hrSchema");
const EmailService = require("./email.service");

class OfferService {
  // ---------- Helpers ----------
  static async _recalcCandidateStatus(candidateId) {
    const counts = await Offer.aggregate([
      { $match: { candidateId: new mongoose.Types.ObjectId(candidateId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const countBy = Object.fromEntries(counts.map(c => [c._id, c.count]));
    const activeCount = (countBy.ACTIVE || 0) + (countBy.ON_HOLD || 0);
    const acceptedCount = countBy.ACCEPTED || 0;
    const joinedCount = countBy.JOINED || 0;

    let next = "AVAILABLE";
    if (joinedCount > 0) {
      next = "JOINED";
    } else if (acceptedCount > 0) {
      next = "ACCEPTED";
    } else if (activeCount > 1) {
      next = "MULTIPLE_OFFERS";
    } else if (activeCount === 1) {
      next = "OFFERED";
    }

    await Candidate.findByIdAndUpdate(candidateId, { status: next });
    return next;
  }

  static async _rejectOtherOffers(candidateId, acceptedOfferId) {
    await Offer.updateMany(
      {
        candidateId,
        _id: { $ne: acceptedOfferId },
        status: { $in: ["ACTIVE", "ON_HOLD"] },
      },
      {
        $set: { status: "REJECTED", updatedAt: new Date() },
        $push: {
          statusHistory: {
            previousStatus: "ACTIVE/ON_HOLD",
            newStatus: "REJECTED",
            reason: "Another offer was accepted",
            updatedAt: new Date(),
          },
        },
      }
    );
  }

  static async _restorePreviouslyRejected(candidateId, exceptOfferId) {
    await Offer.updateMany(
      {
        candidateId,
        _id: { $ne: exceptOfferId },
        status: "REJECTED",
      },
      {
        $set: { status: "ACTIVE", updatedAt: new Date() },
        $push: {
          statusHistory: {
            previousStatus: "REJECTED",
            newStatus: "ACTIVE",
            reason: "Accepted offer withdrawn/put on hold; reopening competition",
            updatedAt: new Date(),
          },
        },
      }
    );
  }

  // ---------- Public API ----------
  static async createOffer(payload, hrId) {
    const { candidateId, position, compensation, timeline, priority, tags } = payload;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) throw new Error("Candidate not found");

    const acceptedOffer = await Offer.findOne({
      candidateId,
      status: "ACCEPTED",
    });
    if (acceptedOffer) {
      throw new Error("Cannot create offer: Candidate already has an accepted offer.");
    }

    const competitionInfo = await this.calculateCompetition(candidateId);

    const offer = new Offer({
      candidateId,
      hrId,
      position,
      compensation,
      timeline,
      status: "ACTIVE",
      priority: priority || "MEDIUM",
      competition: competitionInfo,
      tags,
    });

    const saved = await offer.save();

    await this._recalcCandidateStatus(candidateId);

    await Hr.findByIdAndUpdate(hrId, {
      $inc: { "stats.totalOffersCreated": 1 },
      $set: { "stats.lastActiveAt": new Date() },
    });

    return saved;
  }

  static async calculateCompetition(candidateId, currentOfferId = null) {
    const activeOffers = await Offer.find({
      candidateId,
      status: "ACTIVE",
      _id: { $ne: currentOfferId },
    });

    const competitorCount = activeOffers.length;
    let marketRank = "LEADING";
    if (competitorCount > 2) marketRank = "BELOW_MARKET";
    else if (competitorCount > 0) marketRank = "COMPETITIVE";

    return {
      isCompetitive: competitorCount > 0,
      competitorCount,
      marketRank,
      collaborationNeeded: competitorCount > 0,
    };
  }

  static async getOfferById(offerId) {
    const offer = await Offer.findById(offerId)
      .populate("candidateId", "name email phone profile location status")
      .populate("hrId", "name company.name whatsapp.phoneNumber");
    if (!offer) throw new Error("Offer not found");
    return offer;
  }

  // ✅ Your existing listOffers (kept as is)
  static async listOffers(filters = {}, page = 1, limit = 10) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.hrId) query.hrId = filters.hrId;
    if (filters.candidateId) query.candidateId = filters.candidateId;
    if (filters.search) {
      query.$or = [
        { "position.title": { $regex: filters.search, $options: "i" } },
        { tags: { $in: [filters.search] } },
      ];
    }

    const uniqueCandidates = await Offer.distinct("candidateId", query);
    const total = uniqueCandidates.length;

    const skip = (page - 1) * limit;
    const paginatedCandidates = uniqueCandidates.slice(skip, skip + limit);

    const candidatesWithOffers = await Promise.all(
      paginatedCandidates.map(async (candidateId) => {
        const candidate = await Candidate.findById(candidateId).select("name status");
        const offers = await Offer.find({ candidateId, ...query })
          .select("position compensation status priority timeline hrId")
          .populate({
            path: "hrId",
            select: "name email phone company.name whatsapp.phoneNumber",
          });

        const formattedOffers = offers.map((offer) => ({
          id: offer._id,
          position: {
            title: offer.position.title,
            level: offer.position.level,
          },
          compensation: {
            total:
              offer.compensation.total ??
              (offer.compensation.base || 0) +
                (offer.compensation.variable || 0) +
                (offer.compensation.bonus || 0),
          },
          status: offer.status,
          priority: offer.priority,
          timeline: {
            validTill: offer.timeline?.validTill,
            followUpDate: offer.timeline?.followUpDate,
          },
          hr: offer.hrId
            ? {
                id: offer.hrId._id,
                name: offer.hrId.name,
                email: offer.hrId.email,
                phone: offer.hrId.phone,
                whatsapp: offer.hrId.whatsapp?.phoneNumber,
                company: offer.hrId.company?.name,
              }
            : null,
        }));

        return {
          candidate: {
            id: candidate._id,
            name: candidate.name,
            status: candidate.status,
          },
          offers: formattedOffers,
        };
      })
    );

    return {
      data: candidatesWithOffers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ✅ Fixed updateStatus
  static async updateStatus(offerId, status) {
    const allowed = [
      "DRAFT",
      "ACTIVE",
      "ACCEPTED",
      "REJECTED",
      "EXPIRED",
      "WITHDRAWN",
      "ON_HOLD",
      "JOINED",
    ];
    if (!allowed.includes(status)) {
      throw new Error(`Invalid status. Allowed: ${allowed.join(", ")}`);
    }

    const offer = await Offer.findById(offerId).populate("candidateId").populate("hrId");
    if (!offer) throw new Error("Offer not found");

    const candidateId = offer.candidateId._id;

    // ❌ Prevent ACCEPTED → ACTIVE directly
    if (offer.status === "ACCEPTED" && status === "ACTIVE") {
      throw new Error("Invalid transition: Cannot move from ACCEPTED back to ACTIVE.");
    }

    // ---- ACCEPTED ----
    if (status === "ACCEPTED") {
      const existingAccepted = await Offer.findOne({
        candidateId,
        status: "ACCEPTED",
        _id: { $ne: offer._id },
      });
      if (existingAccepted) {
        throw new Error("Candidate already accepted another offer");
      }

      await Offer.findByIdAndUpdate(offerId, {
        $set: { status: "ACCEPTED", updatedAt: new Date() },
        $push: {
          statusHistory: {
            previousStatus: offer.status,
            newStatus: "ACCEPTED",
            reason: "Offer accepted by candidate",
            updatedAt: new Date(),
          },
        },
      });

      await this._rejectOtherOffers(candidateId, offerId);
      await Candidate.findByIdAndUpdate(candidateId, { status: "ACCEPTED" });

      try {
        await EmailService.sendOfferAcceptedConfirmation(offer.hrId, offer.candidateId, offer);
      } catch (e) {
        console.error("Email notify failed:", e);
      }
    }

    // ---- WITHDRAWN / REJECTED ----
    if (status === "WITHDRAWN" || status === "REJECTED") {
      const wasAccepted = offer.status === "ACCEPTED";

      await Offer.findByIdAndUpdate(offerId, {
        $set: { status, updatedAt: new Date() },
        $push: {
          statusHistory: {
            previousStatus: offer.status,
            newStatus: status,
            reason: wasAccepted ? "Accepted offer withdrawn/rejected" : "Status updated",
            updatedAt: new Date(),
          },
        },
      });

      if (wasAccepted) {
        await this._restorePreviouslyRejected(candidateId, offerId);
      }

      await this._recalcCandidateStatus(candidateId);
    }

    // ---- ON_HOLD ----
    if (status === "ON_HOLD") {
      const wasAccepted = offer.status === "ACCEPTED";

      await Offer.findByIdAndUpdate(offerId, {
        $set: { status: "ON_HOLD", updatedAt: new Date() },
        $push: {
          statusHistory: {
            previousStatus: offer.status,
            newStatus: "ON_HOLD",
            reason: wasAccepted
              ? "Accepted offer put on hold; reopening other offers"
              : "Offer status changed to on hold",
            updatedAt: new Date(),
          },
        },
      });

      if (wasAccepted) {
        await this._restorePreviouslyRejected(candidateId, offerId);
      }

      await this._recalcCandidateStatus(candidateId);
    }

    // ---- JOINED ----
    if (status === "JOINED") {
      await Offer.findByIdAndUpdate(offerId, { $set: { status: "JOINED", updatedAt: new Date() } });

      await Offer.updateMany(
        { candidateId, _id: { $ne: offerId } },
        {
          $set: { status: "EXPIRED", updatedAt: new Date() },
          $push: {
            statusHistory: {
              previousStatus: "ANY",
              newStatus: "EXPIRED",
              reason: "Candidate joined another company",
              updatedAt: new Date(),
            },
          },
        }
      );

      await Candidate.findByIdAndUpdate(candidateId, { status: "JOINED" });
    }

    // ---- Simple statuses ----
    if (["ACTIVE", "EXPIRED", "DRAFT"].includes(status)) {
      await Offer.findByIdAndUpdate(offerId, { $set: { status, updatedAt: new Date() } });
      await this._recalcCandidateStatus(candidateId);
    }

    return await Offer.findById(offerId);
  }
}

module.exports = OfferService;
