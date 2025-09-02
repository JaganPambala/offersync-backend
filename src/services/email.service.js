const nodemailer = require("nodemailer");
const config = require("config");

class EmailService {
  static transporter = null;

  static async initialize() {
    // Create transporter using SMTP configuration
    this.transporter = nodemailer.createTransport({
      host: config.get("email.smtp.host"),
      port: config.get("email.smtp.port"),
      secure: config.get("email.smtp.secure"),
      auth: {
        user: config.get("email.smtp.user"),
        pass: config.get("email.smtp.password"),
      },
    });
  }

  static async sendOfferStatusNotification(
    hrDetails,
    candidateDetails,
    offerDetails
  ) {
    if (!this.transporter) {
      await this.initialize();
    }

    const emailContent = `
            Dear ${hrDetails.name},

            This is to inform you that the candidate ${candidateDetails.name} has accepted an offer from ${offerDetails.acceptedCompany}.

            Offer Details:
            - Position: ${offerDetails.position.title}
            - Company: ${offerDetails.acceptedCompany}

            As a result, the offer from your company (${hrDetails.company.name}) has been automatically placed on hold.
            You can access the offer details and update its status through the OfferSync platform.

            Best regards,
            OfferSync Team
        `;

    return await this.transporter.sendMail({
      from: config.get("email.from"),
      to: hrDetails.email,
      subject: `Offer Update: ${candidateDetails.name} has accepted another offer`,
      text: emailContent,
    });
  }

  static async sendOfferAcceptedConfirmation(
    hrDetails,
    candidateDetails,
    offerDetails
  ) {
    if (!this.transporter) {
      await this.initialize();
    }

    const emailContent = `
            Dear ${hrDetails.name},

            Congratulations! The candidate ${candidateDetails.name} has accepted your offer.

            Offer Details:
            - Position: ${offerDetails.position.title}
            - Company: ${hrDetails.company.name}

            Next Steps:
            1. Please proceed with the onboarding process
            2. Update the expected joining date if needed
            3. Keep track of the candidate's joining status

            Best regards,
            OfferSync Team
        `;

    return await this.transporter.sendMail({
      from: config.get("email.from"),
      to: hrDetails.email,
      subject: `Offer Accepted: ${candidateDetails.name}`,
      text: emailContent,
    });
  }

  static async sendMail({ to, subject, text }) {
    console.log("Preparing to send email to:", to);
    if (!this.transporter) {
      await this.initialize();
    }
    return await this.transporter.sendMail({
      from: config.get("email.from"),
      to,
      subject,
      text,
    });
  }
}

module.exports = EmailService;
