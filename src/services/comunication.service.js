// src/services/communication.service.js

const WhatsAppCommunication = require('../models/whatsappcommunication');
const Offer = require('../models/offer');
const { Hr } = require('../models/hrSchema');
const Candidate = require('../models/candidate');

class CommunicationService {
    /**
     * Initiate a new communication between HRs
     */
    static async initiateCommunication(data) {
        try {
            const { initiatorHR, recipientHR, candidate, offers } = data;

            // Validate existence of entities
            const [candidateExists, initiatorExists, recipientExists] = await Promise.all([
                Candidate.findById(candidate._id),
                Hr.findById(initiatorHR._id),
                Hr.findById(recipientHR._id)
            ]);

            if (!candidateExists) throw new Error('Candidate not found');
            if (!initiatorExists) throw new Error('Initiator HR not found');
            if (!recipientExists) throw new Error('Recipient HR not found');

            // Validate offers
            const offerDocs = await Offer.find({
                _id: { $in: offers.map(o => o._id) }
            });

            if (offerDocs.length !== 2) {
                throw new Error('Both offers must exist');
            }

            // First generate the message and WhatsApp link
            const message = this.generateMessage(candidate.name, offers);
            const whatsappLink = this.generateWhatsAppLink(recipientHR.whatsapp, message);

            // Create communication record
            const communication = new WhatsAppCommunication({
                trackingId: `COM-${Date.now()}`,
                candidateId: candidate._id,
                initiatorHrId: initiatorHR._id,
                recipientHrId: recipientHR._id,
                
                whatsapp: {
                    message: message,
                    recipientPhone: recipientHR.whatsapp,
                    templateUsed: 'DUPLICATE_OFFER',
                    deepLink: whatsappLink  // Added the required deepLink property
                },
                
                status: 'INITIATED',
                offers: offers.map(offer => ({
                    offerId: offer._id,
                    role: offer.hr._id === initiatorHR._id ? 'INITIATOR' : 'RECIPIENT'
                })),

                metrics: {
                    generatedAt: new Date()
                }
            });

            await communication.save();

            // Update offers to ON_HOLD
            await Offer.updateMany(
                { _id: { $in: offers.map(o => o._id) } },
                { 
                    status: 'ON_HOLD',
                    $push: {
                        statusHistory: {
                            previousStatus: 'ACTIVE',
                            newStatus: 'ON_HOLD',
                            reason: 'Duplicate offer coordination initiated',
                            updatedAt: new Date()
                        }
                    }
                }
            );

            return {
                communicationId: communication._id,
                trackingId: communication.trackingId,
                whatsappLink
            };

        } catch (error) {
            console.error('Error in initiateCommunication:', error);
            throw error;
        }
    }

    /**
     * Update communication status
     */
    static async updateStatus(communicationId, newStatus, remarks, hrId) {
        try {
            const communication = await WhatsAppCommunication.findById(communicationId);
            if (!communication) {
                throw new Error('Communication not found');
            }

            // Validate HR is involved in communication
            if (![communication.initiatorHrId.toString(), communication.recipientHrId.toString()].includes(hrId)) {
                throw new Error('Unauthorized to update this communication');
            }

            // Validate status transition
            if (!this.isValidStatusTransition(communication.status, newStatus)) {
                throw new Error(`Invalid status transition from ${communication.status} to ${newStatus}`);
            }

            const oldStatus = communication.status;
            communication.status = newStatus;

            // Update metrics
            switch (newStatus) {
                case 'OPENED':
                    communication.metrics.openedAt = new Date();
                    break;
                case 'RESPONDED':
                    communication.metrics.respondedAt = new Date();
                    break;
                case 'RESOLVED':
                    communication.metrics.resolvedAt = new Date();
                    break;
            }

            // Add to status history
            communication.statusHistory = communication.statusHistory || [];
            communication.statusHistory.push({
                from: oldStatus,
                to: newStatus,
                timestamp: new Date(),
                updatedBy: hrId,
                remarks
            });

            await communication.save();
            return communication;

        } catch (error) {
            console.error('Error in updateStatus:', error);
            throw error;
        }
    }

    /**
     * Record communication outcome
     */
    static async recordOutcome(communicationId, outcomeDetails, hrId) {
        try {
            const communication = await WhatsAppCommunication.findById(communicationId);
            if (!communication) {
                throw new Error('Communication not found');
            }

            // Validate HR is involved
            if (![communication.initiatorHrId.toString(), communication.recipientHrId.toString()].includes(hrId)) {
                throw new Error('Unauthorized to record outcome');
            }

            const { result, description, actions, offerUpdates } = outcomeDetails;

            // Update communication outcome
            communication.outcome = {
                result,
                description,
                actions,
                followUpNeeded: outcomeDetails.followUpNeeded || false,
                followUpDate: outcomeDetails.followUpDate
            };

            // Handle different outcomes
            switch (result) {
                case 'TIMELINE_AGREED':
                    await this.handleTimelineAgreement(communication, offerUpdates);
                    break;
                case 'SALARY_ADJUSTED':
                    await this.handleSalaryAdjustment(communication, offerUpdates);
                    break;
                case 'CANDIDATE_WITHDREW':
                    await this.handleCandidateWithdrawal(communication, offerUpdates);
                    break;
            }

            communication.status = 'RESOLVED';
            communication.metrics.resolvedAt = new Date();
            await communication.save();

            return communication;

        } catch (error) {
            console.error('Error in recordOutcome:', error);
            throw error;
        }
    }

    /**
     * Get communication details
     */
    static async getCommunicationDetails(communicationId, hrId) {
        try {
            const communication = await WhatsAppCommunication.findById(communicationId)
                .populate('candidateId')
                .populate('initiatorHrId')
                .populate('recipientHrId')
                .populate('offers.offerId');

            if (!communication) {
                throw new Error('Communication not found');
            }

            // Validate HR is involved
            if (![communication.initiatorHrId._id.toString(), communication.recipientHrId._id.toString()].includes(hrId)) {
                throw new Error('Unauthorized to view this communication');
            }

            return communication;

        } catch (error) {
            console.error('Error in getCommunicationDetails:', error);
            throw error;
        }
    }

    /**
     * List communications for an HR
     */
    static async listCommunications(hrId) {
        try {
            const communications = await WhatsAppCommunication.find({
                $or: [
                    { initiatorHrId: hrId },
                    { recipientHrId: hrId }
                ]
            })
            .populate('candidateId', 'name')
            .populate('initiatorHrId', 'name company whatsapp')
            .populate('recipientHrId', 'name company whatsapp')
            .sort({ 'metrics.generatedAt': -1 });

            // Transform the data into required format
            return communications.map(comm => {
                const isInitiator = comm.initiatorHrId._id.toString() === hrId;
                const otherParty = isInitiator ? comm.recipientHrId : comm.initiatorHrId;

                // Calculate response and resolution times
                const responseTimeMinutes = comm.metrics.respondedAt && comm.metrics.generatedAt
                    ? Math.round((comm.metrics.respondedAt - comm.metrics.generatedAt) / (1000 * 60))
                    : null;

                const resolutionTimeHours = comm.metrics.resolvedAt && comm.metrics.generatedAt
                    ? Math.round((comm.metrics.resolvedAt - comm.metrics.generatedAt) / (1000 * 60 * 60))
                    : null;

                return {
                    id: comm._id.toString(),
                    trackingId: comm.trackingId,
                    candidate: {
                        id: comm.candidateId._id.toString(),
                        name: comm.candidateId.name
                    },
                    otherParty: {
                        id: otherParty._id.toString(),
                        name: otherParty.name,
                        company: otherParty.company.name
                    },
                    status: comm.status,
                    role: isInitiator ? "INITIATOR" : "RECIPIENT",
                    // Include outcome only if it exists
                    ...(comm.outcome && {
                        outcome: {
                            result: comm.outcome.result,
                            description: comm.outcome.description,
                            actions: comm.outcome.actions || []
                        }
                    }),
                    metrics: {
                        responseTimeMinutes,
                        resolutionTimeHours
                    },
                    createdAt: comm.metrics.generatedAt
                };
            });

        } catch (error) {
            console.error('Error in listCommunications:', error);
            throw error;
        }
    }

    // Helper methods
    static generateMessage(candidateName, offers) {
        return `Hi! This is regarding duplicate offers for ${candidateName}.

Offer Details:
1. ${offers[0].company}: ${offers[0].position.title}
2. ${offers[1].company}: ${offers[1].position.title}

Can we coordinate on this?`;
    }

    static generateWhatsAppLink(phone, message) {
        const cleanPhone = phone.replace(/\D/g, '');
        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }

    static isValidStatusTransition(from, to) {
        const transitions = {
            'INITIATED': ['OPENED'],
            'OPENED': ['RESPONDED'],
            'RESPONDED': ['RESOLVED'],
            'RESOLVED': [] // End state
        };

        return transitions[from]?.includes(to) || false;
    }

    // Outcome handlers
    static async handleTimelineAgreement(communication, updates) {
        const { postponedOfferId, newJoinDate } = updates;
        
        // 1. Update postponed offer
        await Offer.findByIdAndUpdate(postponedOfferId, {
            status: 'ACTIVE',
            expectedJoinDate: newJoinDate,
            $push: {
                statusHistory: {
                    previousStatus: 'ON_HOLD',
                    newStatus: 'ACTIVE',
                    reason: 'Timeline agreement reached',
                    updatedAt: new Date()
                }
            }
        });

        // 2. Update other offer
        const otherOffer = communication.offers.find(o => o.offerId.toString() !== postponedOfferId);
        await Offer.findByIdAndUpdate(otherOffer.offerId, {
            status: 'ACTIVE',
            $push: {
                statusHistory: {
                    previousStatus: 'ON_HOLD',
                    newStatus: 'ACTIVE',
                    reason: 'Timeline agreement reached',
                    updatedAt: new Date()
                }
            }
        });

        // 3. Update communication outcome
        communication.outcome = {
            result: 'TIMELINE_AGREED',
            description: `Timeline agreement reached. New join date set for postponed offer.`,
            actions: [
                `Postponed offer join date updated to ${newJoinDate}`,
                `Other offer continues with original timeline`
            ]
        };

        // 4. Update communication status
        communication.status = 'RESOLVED';
        communication.metrics.resolvedAt = new Date();
        
        await communication.save();
    }

    static async handleSalaryAdjustment(communication, updates) {
        const { offerId, newCompensation } = updates;
        
        await Offer.findByIdAndUpdate(offerId, {
            status: 'ACTIVE',
            compensation: newCompensation,
            $push: {
                statusHistory: {
                    previousStatus: 'ON_HOLD',
                    newStatus: 'ACTIVE',
                    reason: 'Salary adjustment agreed',
                    updatedAt: new Date()
                }
            }
        });
    }

    static async handleCandidateWithdrawal(communication, updates) {
        const { withdrawnOfferId } = updates;
        
        await Offer.findByIdAndUpdate(withdrawnOfferId, {
            status: 'WITHDRAWN',
            $push: {
                statusHistory: {
                    previousStatus: 'ON_HOLD',
                    newStatus: 'WITHDRAWN',
                    reason: 'Candidate withdrew',
                    updatedAt: new Date()
                }
            }
        });
        
        // Activate remaining offer
        const remainingOffer = communication.offers.find(o => o.offerId.toString() !== withdrawnOfferId);
        await Offer.findByIdAndUpdate(remainingOffer.offerId, {
            status: 'ACTIVE',
            $push: {
                statusHistory: {
                    previousStatus: 'ON_HOLD',
                    newStatus: 'ACTIVE',
                    reason: 'Selected over withdrawn offer',
                    updatedAt: new Date()
                }
            }
        });
    }
}

module.exports = CommunicationService;
