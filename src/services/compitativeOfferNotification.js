const EmailService = require("./email.service");

async function sendCompetitiveOfferEmail({
  to,
  candidateName,
  competingHrName,
  competingCompany,
  offerPosition,
  offerId,
}) {
  console.log("Sending competitive offer email to:", to);
  const subject = `⚠️ Competing Offer for Candidate ${candidateName}`;
  const body = `
Hi,

A new competitive offer has been created for candidate ${candidateName}.

📌 Offer Details:
- Position: ${offerPosition}
- Created by: ${competingHrName} (${competingCompany})
- Offer ID: #${offerId}

Please review your existing offer and coordinate if necessary.

— OfferSync System
  `;
  console.log("Email subject:", subject);
  return EmailService.sendMail({ to, subject, text: body });
}

module.exports = { sendCompetitiveOfferEmail };
