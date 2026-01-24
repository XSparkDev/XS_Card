/**
 * Contact Confirmation Email Template
 * Sent to the person who filled out the contact form
 */

const { getBothStoreLinks } = require('../../utils/deviceDetection');

/**
 * @param {Object} params - Email parameters
 * @param {string} params.ownerName - Name of the card owner
 * @param {string} params.contactName - Name of the person who filled the form (optional)
 * @param {string} params.metAt - Where/how they met (optional)
 * @param {string} params.dayString - Date string (formatted)
 * @param {string} params.ownerContactLink - Link to view the card again (optional)
 * @returns {Object} Object with subject and html properties
 */
function getContactConfirmationEmail(params) {
    const {
        ownerName,
        contactName = '',
        metAt = '',
        dayString,
        ownerContactLink = null
    } = params;

    // Get store links
    const bothLinks = getBothStoreLinks();
    const storeLinkHtml = `<a href="${bothLinks.ios}">App Store</a> or <a href="${bothLinks.android}">Google Play</a>`;

    // Build subject
    const subject = `XS Card connection made with ${ownerName}.`;

    // Build HTML body
    let html = `
        <p>Hello ${contactName || 'there'},</p>
        <p>${ownerName} is excited to have met you.</p>
        <p>You made a great XS Card ${storeLinkHtml} connection with ${ownerName}${metAt ? ` at ${metAt}` : ''} on ${dayString}.</p>
        <p>You will now have ${ownerName} in your device's phonebook. Download XS Card on ${storeLinkHtml} to keep networking.</p>
    `;

    // Add card link if provided
    if (ownerContactLink) {
        html += `
        <p>If you want to view the card again, you can visit: <a href="${ownerContactLink}">${ownerContactLink}</a></p>
        `;
    }

    // Add footer
    html += `
        <br>
        <br>
        <br>
        <p style="color: #666; font-size: 12px;">This was sent automatically by XS Card.</p>
    `;

    return {
        subject,
        html: html.trim()
    };
}

module.exports = {
    getContactConfirmationEmail
};

