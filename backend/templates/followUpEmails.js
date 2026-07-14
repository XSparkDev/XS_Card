/**
 * Follow-Up Email Templates
 *
 * Six templates across three days (Day 1 / 6 / 9) for two recipients:
 *   owner   — the XS Card holder whose card was scanned
 *   scanner — the person who scanned the card
 *
 * Each export is a function that accepts a data object and returns
 * { subject, html } ready to pass to sendMailWithStatus.
 */

// ─── Shared helpers ───────────────────────────────────────────────────────────

const header = `
  <div style="background-color:#1B2B5B;padding:20px 24px;text-align:center;">
    <span style="color:#FF4B6E;font-size:26px;font-weight:800;font-family:Arial,sans-serif;">XS</span><span style="color:#ffffff;font-size:26px;font-weight:800;font-family:Arial,sans-serif;">Card</span>
  </div>`;

const footer = `
  <div style="background-color:#f5f5f5;padding:16px 24px;text-align:center;border-top:1px solid #e0e0e0;">
    <p style="color:#999;font-size:11px;font-family:Arial,sans-serif;margin:0;">
      © ${new Date().getFullYear()} XS Card · <a href="https://xscard.app" style="color:#FF4B6E;text-decoration:none;">xscard.app</a>
    </p>
    <p style="color:#bbb;font-size:10px;font-family:Arial,sans-serif;margin:4px 0 0;">
      You are receiving this because a new connection was made through XS Card.
    </p>
  </div>`;

const ctaButton = (href, label) => `
  <div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background-color:#FF4B6E;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;font-family:Arial,sans-serif;letter-spacing:0.3px;">${label}</a>
  </div>`;

const contactCard = ({ name, surname, email, phone, company, occupation }) => `
  <div style="background-color:#f9f9f9;border-left:4px solid #FF4B6E;border-radius:6px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#1B2B5B;font-family:Arial,sans-serif;">${name || ''} ${surname || ''}</p>
    ${company ? `<p style="margin:0 0 4px;font-size:13px;color:#555;font-family:Arial,sans-serif;">🏢 ${company}</p>` : ''}
    ${occupation ? `<p style="margin:0 0 4px;font-size:13px;color:#555;font-family:Arial,sans-serif;">💼 ${occupation}</p>` : ''}
    ${email ? `<p style="margin:0 0 4px;font-size:13px;color:#555;font-family:Arial,sans-serif;">✉️ <a href="mailto:${email}" style="color:#FF4B6E;text-decoration:none;">${email}</a></p>` : ''}
    ${phone ? `<p style="margin:0;font-size:13px;color:#555;font-family:Arial,sans-serif;">📞 ${phone}</p>` : ''}
  </div>`;

const wrap = (body) => `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background-color:#f0f0f0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:24px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr><td>${header}</td></tr>
          <tr><td style="padding:28px 28px 8px;">${body}</td></tr>
          <tr><td>${footer}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;

const p = (text, style = '') =>
  `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;margin:0 0 14px;${style}">${text}</p>`;

const h2 = (text) =>
  `<h2 style="font-family:Arial,sans-serif;font-size:20px;color:#1B2B5B;margin:0 0 16px;">${text}</h2>`;

// ─── Day 1 — 24 hours after scan ─────────────────────────────────────────────

exports.day1Owner = ({ ownerName, scanner }) => {
  const firstName = String(ownerName || '').split(' ')[0] || 'there';
  const scannerFullName = `${scanner.name || ''} ${scanner.surname || ''}`.trim();
  const mailtoHref = scanner.email ? `mailto:${scanner.email}` : '#';

  return {
    subject: `🤝 You made a new connection — follow up with ${scannerFullName} today`,
    html: wrap(`
      ${h2(`Congratulations on your new connection, ${firstName}!`)}
      ${p(`You exchanged details with <strong>${scannerFullName}</strong> yesterday. Research shows that the best time to strengthen a new business relationship is within the first 24–48 hours — and that window is closing.`)}
      ${p(`Many promising connections fade simply because nobody reached out first. A quick message, a phone call, or an invitation to meet is all it takes to turn a scan into a real opportunity.`)}
      ${p('<strong>Your new connection\'s details:</strong>')}
      ${contactCard(scanner)}
      ${ctaButton(mailtoHref, 'Contact Your New Connection →')}
      ${p(`Don't let this opportunity slip away. Reach out today.`, 'color:#888;font-size:13px;')}
    `),
  };
};

exports.day1Scanner = ({ ownerName, ownerData }) => {
  const ownerFullName = ownerName || 'your new connection';
  const appStoreUrl = 'https://apps.apple.com/app/id6742452317';

  return {
    subject: `Great connecting with ${ownerFullName}! Here's how to keep the momentum going`,
    html: wrap(`
      ${h2(`Great connecting with ${ownerFullName}! 👋`)}
      ${p(`You scanned ${ownerFullName}'s XS Card yesterday. Whether you met at a conference, an event, or just in passing — that connection is worth nurturing.`)}
      ${p(`The best relationships grow from the first follow-up. If you haven't already, consider sending a quick message to say it was great to meet them — or even suggest a call to explore how you might work together.`)}
      ${ownerData.email || ownerData.phone ? `
        ${p('<strong>Reach them here:</strong>')}
        <div style="background-color:#f9f9f9;border-left:4px solid #1B2B5B;border-radius:6px;padding:14px 20px;margin:16px 0;">
          ${ownerData.email ? `<p style="margin:0 0 4px;font-size:13px;color:#555;font-family:Arial,sans-serif;">✉️ <a href="mailto:${ownerData.email}" style="color:#FF4B6E;text-decoration:none;">${ownerData.email}</a></p>` : ''}
          ${ownerData.phone ? `<p style="margin:0;font-size:13px;color:#555;font-family:Arial,sans-serif;">📞 ${ownerData.phone}</p>` : ''}
        </div>` : ''}
      <div style="background-color:#1B2B5B;padding:20px;border-radius:8px;margin:24px 0;text-align:center;">
        <p style="color:#fff;font-size:15px;font-weight:700;margin:0 0 8px;font-family:Arial,sans-serif;">Get your own XS Card</p>
        <p style="color:#ccc;font-size:13px;margin:0 0 16px;font-family:Arial,sans-serif;">Share your contact details as effortlessly as ${ownerFullName} shared theirs.</p>
        ${ctaButton(appStoreUrl, 'Get XS Card Free')}
      </div>
    `),
  };
};

// ─── Day 6 ────────────────────────────────────────────────────────────────────

exports.day6Owner = ({ ownerName, scanner }) => {
  const firstName = String(ownerName || '').split(' ')[0] || 'there';
  const scannerFullName = `${scanner.name || ''} ${scanner.surname || ''}`.trim();
  const mailtoHref = scanner.email ? `mailto:${scanner.email}` : '#';

  return {
    subject: `⏳ You made a valuable connection — don't let it fade`,
    html: wrap(`
      ${h2(`${firstName}, six days have passed.`)}
      ${p(`A week ago you connected with <strong>${scannerFullName}</strong>. That first impression was made — but the relationship needs one more push to stick.`)}
      ${p(`Studies consistently show that most business relationships that fail, fail because of silence — not rejection. One message is often all it takes to go from "we met once" to "valued contact".`)}
      ${p(`It's not too late. Schedule 5 minutes today to:`)}
      <ul style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.8;margin:0 0 16px;">
        <li>Send a quick follow-up email</li>
        <li>Make a brief phone call</li>
        <li>Propose a meeting, coffee, or call</li>
      </ul>
      ${p('<strong>Their details are right here:</strong>')}
      ${contactCard(scanner)}
      ${ctaButton(mailtoHref, 'Follow Up Now →')}
    `),
  };
};

exports.day6Scanner = ({ ownerName, ownerData }) => {
  const ownerFullName = ownerName || 'your connection';

  return {
    subject: `A week on — stay connected with ${ownerFullName}`,
    html: wrap(`
      ${h2(`It's been almost a week since you met ${ownerFullName}.`)}
      ${p(`Sometimes life gets busy and follow-ups get pushed aside. That's completely normal — but the people who act on new connections in the first week are far more likely to turn them into something valuable.`)}
      ${p(`If you haven't reached out yet, now is a great time. Even a brief "great to meet you" message keeps the door open for future collaboration.`)}
      ${ownerData.email ? `${ctaButton(`mailto:${ownerData.email}`, `Message ${ownerFullName} →`)}` : ''}
      ${p(`Networking isn't about collecting contacts — it's about nurturing them.`, 'color:#888;font-size:13px;')}
    `),
  };
};

// ─── Day 9 — final reminder ───────────────────────────────────────────────────

exports.day9Owner = ({ ownerName, scanner }) => {
  const firstName = String(ownerName || '').split(' ')[0] || 'there';
  const scannerFullName = `${scanner.name || ''} ${scanner.surname || ''}`.trim();
  const mailtoHref = scanner.email ? `mailto:${scanner.email}` : '#';

  return {
    subject: `🔔 Final reminder: ${scannerFullName} is waiting to hear from you`,
    html: wrap(`
      ${h2(`${firstName}, this is your final reminder.`)}
      ${p(`Nine days ago, <strong>${scannerFullName}</strong> scanned your XS Card. That moment created a real opportunity — but opportunities don't wait forever.`)}
      <div style="background-color:#FFF3F5;border:1px solid #FF4B6E;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="font-family:Arial,sans-serif;font-size:15px;color:#1B2B5B;font-weight:700;margin:0 0 8px;">Why follow up matters:</p>
        <ul style="font-family:Arial,sans-serif;font-size:14px;color:#555;line-height:1.8;margin:0;padding-left:20px;">
          <li>80% of business is lost due to lack of follow-up</li>
          <li>One conversation today could be your next client, partner, or referral</li>
          <li>It costs nothing to reach out — and could be worth everything</li>
        </ul>
      </div>
      ${p(`This is the last automated reminder for this connection. Whether you reach out is entirely up to you — but we'd encourage you to take 2 minutes and send a message today.`)}
      ${p('<strong>Contact details one last time:</strong>')}
      ${contactCard(scanner)}
      ${ctaButton(mailtoHref, 'Reach Out Now — It Only Takes 2 Minutes')}
      ${p(`After today, this follow-up reminder sequence ends. The opportunity is yours.`, 'color:#888;font-size:12px;')}
    `),
  };
};

exports.day9Scanner = ({ ownerName, ownerData }) => {
  const ownerFullName = ownerName || 'your connection';
  const appStoreUrl = 'https://apps.apple.com/app/id6742452317';

  return {
    subject: `One last nudge — your connection with ${ownerFullName} is fading`,
    html: wrap(`
      ${h2(`This is the last time we'll nudge you.`)}
      ${p(`Nine days ago you scanned <strong>${ownerFullName}'s</strong> XS Card. If you haven't connected yet, this is your final reminder.`)}
      ${p(`Great relationships often come from unexpected meetings. The person whose card you scanned could be a future collaborator, client, or friend — but only if someone takes the first step.`)}
      ${p(`A single message is all it takes. Something as simple as:`)}
      <div style="background-color:#f5f5f5;border-radius:6px;padding:16px 20px;margin:16px 0;font-style:italic;font-family:Arial,sans-serif;font-size:14px;color:#555;line-height:1.6;">
        "Hi ${ownerFullName}, it was great connecting at [event/place]. Would love to stay in touch — open to a quick call sometime?"
      </div>
      ${ownerData.email ? `${ctaButton(`mailto:${ownerData.email}`, `Send a Message to ${ownerFullName}`)}` : ''}
      <div style="background-color:#1B2B5B;padding:18px;border-radius:8px;margin:24px 0;text-align:center;">
        <p style="color:#fff;font-size:14px;font-weight:700;margin:0 0 6px;font-family:Arial,sans-serif;">Want to collect connections like this one?</p>
        <p style="color:#ccc;font-size:12px;margin:0 0 14px;font-family:Arial,sans-serif;">Get your own XS Card and turn every meeting into a lasting contact.</p>
        <a href="${appStoreUrl}" style="display:inline-block;background-color:#FF4B6E;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:700;font-family:Arial,sans-serif;">Get XS Card</a>
      </div>
      ${p(`After this email, our automated sequence for this connection ends. We hope you made the most of it.`, 'color:#bbb;font-size:11px;')}
    `),
  };
};
