/**
 * Quote PDF Generator
 * 
 * Generates enterprise quote PDFs matching the frontend implementation exactly.
 * Based on BACKEND_ENTERPRISE_QUOTE_PDF_SPEC.md
 * 
 * PDF STRUCTURE (Sections):
 * =========================
 * 1. WATERMARK (background, rotated -45deg, opacity 0.08)
 * 2. HEADER SECTION
 *    - Title "Enterprise Quote" (left)
 *    - Quote ID label + value (right, aligned with title)
 *    - Subtitle "XS Card Digital Business Card Solution" (left, below title)
 *    - Date and Valid Until (left, below subtitle)
 *    - Border line (bottom)
 * 3. PREPARED FOR SECTION
 *    - Heading "Prepared For"
 *    - Gray box with company info (name, contact, email)
 * 4. PRICING SECTION
 *    - Heading "Pricing" or "Pricing Estimate"
 *    - Purple/blue gradient box with:
 *      - Price label (left) + Price value (right) - same row
 *      - Employee count (left) + Currency (right) - same row
 * 5. PRICE RANGE SECTION (optional, only if priceRange exists)
 *    - Gray box with min/max columns
 *    - Mid-point text at bottom
 * 6. PAYMENT SECTION
 *    - Border line (top)
 *    - Heading "Proceed to Payment"
 *    - Green/emerald gradient box with:
 *      - QR code (left) + Payment text (right) - side by side
 *      - "Ready to proceed with payment" text
 *      - Payment URL (clickable)
 *      - Instruction text
 * 7. FOOTER SECTION
 *    - Border line (top)
 *    - Status + Disclaimer (left)
 *    - XS Card branding (right)
 * 8. CLICKABLE LINK OVERLAY (82% down page, covers payment URL area)
 */

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { getCompanyInfo } = require('./companyInfo');

/**
 * Format date as "DD Month YYYY" (e.g., "27 January 2025")
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get payment entry URL for quote
 */
function getQuotePaymentEntryUrl(quoteId, baseUrl) {
  return `${baseUrl}/pay/quote/${encodeURIComponent(quoteId)}`;
}

/**
 * Format employee count with thousand separators
 */
function formatEmployeeCount(count) {
  if (typeof count === 'string') {
    return `${count} employees`;
  }
  if (typeof count === 'number') {
    return `${count.toLocaleString()} employees`;
  }
  return 'N/A employees';
}

/**
 * Generate QR code as buffer
 */
async function generateQRCodeBuffer(url) {
  return await QRCode.toBuffer(url, {
    width: 128,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

/**
 * Convert mm to points (1mm = 2.83465 points)
 */
function mmToPoints(mm) {
  return mm * 2.83465;
}

/**
 * Draw a rounded rectangle using pdfkit paths
 */
function drawRoundedRect(doc, x, y, width, height, radius) {
  // Draw rounded rectangle path
  doc.moveTo(x + radius, y);
  doc.lineTo(x + width - radius, y);
  doc.quadraticCurveTo(x + width, y, x + width, y + radius);
  doc.lineTo(x + width, y + height - radius);
  doc.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  doc.lineTo(x + radius, y + height);
  doc.quadraticCurveTo(x, y + height, x, y + height - radius);
  doc.lineTo(x, y + radius);
  doc.quadraticCurveTo(x, y, x + radius, y);
  doc.closePath();
}

/**
 * Generate quote PDF
 * 
 * @param {Object} quote - Quote data object
 * @param {string} baseUrl - Base URL for payment links (e.g., "https://api.xscard.com")
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateQuotePDF(quote, baseUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      // Calculate PDF dimensions (A4 width: 210mm, height calculated from content)
      // We'll use A4 portrait as default, but adjust if needed
      const pageWidthMM = 210; // A4 width
      const pageHeightMM = 297; // A4 height (will adjust if content is longer)
      
      // Create PDF document
      const doc = new PDFDocument({
        size: [mmToPoints(pageWidthMM), mmToPoints(pageHeightMM)],
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      });

      // Collect PDF chunks
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Page dimensions in points
      const pageWidth = mmToPoints(pageWidthMM);
      const pageHeight = mmToPoints(pageHeightMM);
      
      // Margins (converting from Tailwind padding: p-6 = 24px ≈ 6.77mm, p-8 = 32px ≈ 9mm)
      const marginMM = 8; // md:p-8 = 32px ≈ 8mm
      const margin = mmToPoints(marginMM);
      
      // Starting position
      let y = margin;
      const contentWidth = pageWidth - (margin * 2);

      // ========================================================================
      // SECTION 1: WATERMARK (draw first so it's behind everything)
      // ========================================================================
      doc.save();
      doc.opacity(0.08); // Very subtle, won't block content
      doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
      doc.fontSize(96); // 6rem = 96px
      doc.font('Helvetica-Bold');
      doc.fillColor('#000000');
      const watermarkText = 'QUOTE';
      const watermarkWidth = doc.widthOfString(watermarkText);
      const watermarkHeight = doc.heightOfString(watermarkText, { width: watermarkWidth });
      doc.text(watermarkText, (pageWidth - watermarkWidth) / 2, (pageHeight - watermarkHeight) / 2);
      doc.restore();

      // ========================================================================
      // SECTION 2: HEADER SECTION
      // ========================================================================
      const headerStartY = y;
      
      // Left side: Title
      doc.font('Helvetica-Bold');
      doc.fontSize(24); // text-2xl = 24px
      doc.fillColor('#111827'); // text-gray-900
      doc.text('Enterprise Quote', margin, y);
      
      // Right side: Quote ID (aligned with title)
      const quoteIdText = quote.quoteId || 'N/A';
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#6b7280'); // text-gray-500
      const quoteIdLabel = 'Quote ID';
      const quoteIdLabelWidth = doc.widthOfString(quoteIdLabel);
      doc.text(quoteIdLabel, pageWidth - margin - quoteIdLabelWidth, headerStartY);
      
      doc.font('Courier'); // font-mono
      doc.fontSize(12);
      doc.fillColor('#111827');
      const quoteIdTextWidth = doc.widthOfString(quoteIdText);
      doc.text(quoteIdText, pageWidth - margin - quoteIdTextWidth, headerStartY + 12);
      
      // Subtitle (moved down with more spacing from title)
      y += 35; // Increased spacing after title
      
      doc.font('Helvetica');
      doc.fontSize(12); // text-xs = 12px
      doc.fillColor('#4b5563'); // text-gray-600
      doc.text('XS Card Digital Business Card Solution', margin, y);
      
      // Date and Valid Until (moved down with more spacing)
      y += 24; // Increased spacing after subtitle
      
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#4b5563');
      const dateText = `Date: ${formatDate(quote.createdAt)}`;
      const validUntilText = `Valid Until: ${formatDate(quote.expiresAt)}`;
      doc.text(dateText, margin, y);
      const bulletX = margin + doc.widthOfString(dateText) + 8;
      doc.text('•', bulletX, y);
      doc.text(validUntilText, bulletX + 8, y);
      
      y += 40; // Increased spacing before header border
      
      // Header border (border-b-2) - moved down in response to spacing changes
      doc.strokeColor('#e5e7eb'); // border-gray-200
      doc.lineWidth(2);
      doc.moveTo(margin, y);
      doc.lineTo(pageWidth - margin, y);
      doc.stroke();
      
      y += 28; // Increased spacing after header border

      // ========================================================================
      // SECTION 3: PREPARED FOR SECTION
      // ========================================================================
      const preparedForY = y;
      
      doc.font('Helvetica-Bold');
      doc.fontSize(16); // text-base = 16px
      doc.fillColor('#111827');
      doc.text('Prepared For', margin, y);
      
      y += 28; // Increased spacing after "Prepared For" heading
      
      // Background box (bg-gray-50 = #f9fafb)
      const boxY = y;
      const boxHeight = 90; // Increased box height for more internal spacing
      const borderRadius = 8; // rounded-lg = 8px
      
      // Draw rounded rectangle background FIRST (so text appears on top)
      doc.save();
      doc.fillColor('#f9fafb');
      drawRoundedRect(doc, margin, boxY, contentWidth, boxHeight, borderRadius);
      doc.fill();
      doc.restore();
      
      // Now draw text ON TOP of the box
      const textStartY = boxY + 24; // Increased padding inside box
      
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      doc.fillColor('#111827');
      doc.text(quote.companyName || 'N/A', margin + 12, textStartY);
      
      doc.font('Helvetica');
      doc.fontSize(14); // text-sm = 14px
      doc.fillColor('#374151'); // text-gray-700
      doc.text(quote.contactName || 'N/A', margin + 12, textStartY + 24);
      
      doc.font('Helvetica');
      doc.fontSize(12); // text-xs = 12px
      doc.fillColor('#4b5563'); // text-gray-600
      doc.text(quote.contactEmail || 'N/A', margin + 12, textStartY + 40);
      
      y = boxY + boxHeight + 36; // Increased spacing after Prepared For box

      // ========================================================================
      // SECTION 4: PRICING SECTION
      // ========================================================================
      const isRange = typeof quote.numberOfEmployees === 'string';
      const pricingTitle = isRange ? 'Pricing Estimate' : 'Pricing';
      
      doc.font('Helvetica-Bold');
      doc.fontSize(16);
      doc.fillColor('#111827');
      doc.text(pricingTitle, margin, y);
      
      y += 28; // Increased spacing between heading and box
      
      // Gradient box (from-purple-50 to-blue-50)
      // Simulate gradient with a light purple-blue fill
      const priceBoxY = y;
      const priceBoxHeight = 100; // Increased box height for more internal spacing
      
      // Draw box background FIRST
      doc.save();
      doc.fillColor('#f0f5ff'); // Light purple-blue blend
      drawRoundedRect(doc, margin, y, contentWidth, priceBoxHeight, 8);
      doc.fill();
      doc.restore();
      
      // Draw content ON TOP of box
      const priceContentY = priceBoxY + 24; // Increased padding inside box
      
      // Price label (top row, left side)
      const priceLabel = isRange ? 'Estimated Yearly Price' : 'Yearly Price';
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#4b5563');
      doc.text(priceLabel.toUpperCase(), margin + 16, priceContentY);
      
      // Price value (top row, right-aligned)
      const priceText = quote.formattedPrice || 'N/A';
      doc.font('Helvetica-Bold');
      doc.fontSize(30); // text-3xl = 30px
      doc.fillColor('#111827');
      const priceWidth = doc.widthOfString(priceText);
      doc.text(priceText, pageWidth - margin - priceWidth - 16, priceContentY);
      
      // Employee count and currency (bottom row)
      const bottomRowY = priceContentY + 36; // Increased spacing between rows
      const employeeText = formatEmployeeCount(quote.numberOfEmployees);
      const currencyText = `${quote.currency || 'ZAR'} • ${quote.subscriptionType || 'yearly'}`.toUpperCase();
      
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#4b5563');
      doc.text(employeeText, margin + 16, bottomRowY);
      
      const currencyWidth = doc.widthOfString(currencyText);
      doc.text(currencyText, pageWidth - margin - currencyWidth - 16, bottomRowY);
      
      y = priceBoxY + priceBoxHeight + 36; // Increased spacing after pricing box

      // ========================================================================
      // SECTION 5: PRICE RANGE SECTION (optional, only if priceRange exists)
      // ========================================================================
      if (quote.priceRange) {
        const rangeBoxY = y;
        
        // Calculate height - increased spacing throughout
        const topPadding = 24; // Increased padding
        const headingHeight = 14; // font size 12 + line height
        const headingSpacing = 24; // Increased spacing between heading and content
        const columnsContentHeight = 72; // Increased spacing between elements (label + price + employees)
        const bottomPadding = 24; // Increased bottom padding
        
        const rangeBoxHeight = topPadding + headingHeight + headingSpacing + columnsContentHeight + bottomPadding;
        
        doc.save();
        doc.fillColor('#f9fafb');
        drawRoundedRect(doc, margin, y, contentWidth, rangeBoxHeight, 8);
        doc.fill();
        doc.restore();
        
        y += topPadding;
        
        doc.font('Helvetica-Bold');
        doc.fontSize(12);
        doc.fillColor('#374151');
        doc.text('Price Range Estimate', margin + 12, y);
        
        y += headingSpacing;
        
        // Two columns for min/max
        const columnWidth = (contentWidth - 24) / 2;
        const columnStartY = y;
        
        // Minimum column - increased spacing between elements
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        doc.text('Minimum', margin + 12, columnStartY);
        
        doc.font('Helvetica-Bold');
        doc.fontSize(12);
        doc.fillColor('#111827');
        doc.text(quote.priceRange.formattedMinPrice || 'N/A', margin + 12, columnStartY + 24);
        
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#6b7280'); // text-gray-500
        doc.text(`${quote.priceRange.minEmployees} employees`, margin + 12, columnStartY + 48);
        
        // Maximum column - increased spacing between elements
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        doc.text('Maximum', margin + 12 + columnWidth, columnStartY);
        
        doc.font('Helvetica-Bold');
        doc.fontSize(12);
        doc.fillColor('#111827');
        doc.text(quote.priceRange.formattedMaxPrice || 'N/A', margin + 12 + columnWidth, columnStartY + 24);
        
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#6b7280');
        doc.text(`${quote.priceRange.maxEmployees} employees`, margin + 12 + columnWidth, columnStartY + 48);
        
        y = rangeBoxY + rangeBoxHeight + 36; // Increased spacing after price range box
      }

      // ========================================================================
      // SECTION 6: PAYMENT SECTION
      // ========================================================================
      const paymentBoxY = y;
      
      // Border top
      doc.strokeColor('#e5e7eb');
      doc.lineWidth(1);
      doc.moveTo(margin, y + 3);
      doc.lineTo(pageWidth - margin, y + 3);
      doc.stroke();
      
      y += 32; // Increased spacing after payment border
      
      doc.font('Helvetica-Bold');
      doc.fontSize(16);
      doc.fillColor('#111827');
      doc.text('Proceed to Payment', margin, y);
      
      y += 28; // Increased spacing between heading and payment box
      
      // Payment box (from-green-50 to-emerald-50)
      // Calculate height to include QR container + "Scan to pay" text inside box
      const qrSizeEstimate = mmToPoints(45.2); // Estimate for calculation
      const qrPaddingEstimate = 6;
      const qrContainerSizeEstimate = qrSizeEstimate + qrPaddingEstimate * 2;
      const scanTextHeight = 12; // fontSize
      const scanTextSpacing = 18; // Increased spacing below QR container
      const paymentBoxHeight = 24 + qrContainerSizeEstimate + scanTextSpacing + scanTextHeight + 24; // Increased padding throughout
      doc.save();
      doc.fillColor('#f0fdf4'); // Light green-emerald blend
      drawRoundedRect(doc, margin, y, contentWidth, paymentBoxHeight, 8);
      doc.fill();
      doc.restore();
      
      const paymentContentY = y + 24; // Increased padding inside box
      
      // Generate QR code
      const paymentUrl = getQuotePaymentEntryUrl(quote.quoteId, baseUrl);
      let qrCodeBuffer;
      let qrSize = null; // size in points for layout calculations
      try {
        qrCodeBuffer = await generateQRCodeBuffer(paymentUrl);
        
        // QR code image (128x128px = 45.2mm)
        const qrSizeMM = 45.2;
        qrSize = mmToPoints(qrSizeMM);

        // White container with rounded edges and at least 2pt padding around QR
        const qrPadding = 6; // clearance on each side
        const qrContainerX = margin + 16;
        const qrContainerY = paymentContentY;
        const qrContainerSize = qrSize + qrPadding * 2;

        // Draw white rounded container
        doc.save();
        doc.fillColor('#ffffff');
        drawRoundedRect(doc, qrContainerX, qrContainerY, qrContainerSize, qrContainerSize, 8);
        doc.fill();

        // Border for container
        doc.strokeColor('#e5e7eb');
        doc.lineWidth(2);
        drawRoundedRect(doc, qrContainerX, qrContainerY, qrContainerSize, qrContainerSize, 8);
        doc.stroke();
        doc.restore();

        // Draw QR image inside container with padding
        doc.image(qrCodeBuffer, qrContainerX + qrPadding, qrContainerY + qrPadding, {
          width: qrSize,
          height: qrSize
        });
        
        // "Scan to pay" text under the container
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        const scanText = 'Scan to pay';
        const scanTextWidth = doc.widthOfString(scanText);
        const scanTextY = qrContainerY + qrContainerSize + 18;
        doc.text(
          scanText,
          qrContainerX + (qrContainerSize - scanTextWidth) / 2,
          scanTextY
        );
      } catch (qrError) {
        console.warn('QR code generation failed:', qrError);
        // Continue without QR code
      }
      
      // Payment text (to the right of QR code, or centered if no QR)
      const hasQr = qrCodeBuffer && qrSize;
      // Add extra horizontal spacing (5pt) between QR container and text
      const textX = hasQr ? margin + 16 + qrSize + 21 : margin + 16;
      const textWidth = hasQr ? contentWidth - qrSize - 48 : contentWidth - 32;
      // Nudge text block down a bit so its top visually aligns with QR container top
      const paymentTextY = paymentContentY + 5;
      
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      doc.fillColor('#111827');
      doc.text('Ready to proceed with payment', textX, paymentTextY, {
        width: textWidth,
        align: hasQr ? 'left' : 'center'
      });
      
      // Payment URL (clickable link)
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#2563eb'); // text-blue-600
      const urlText = paymentUrl;
      doc.text(urlText, textX, paymentTextY + 32, { // Increased spacing
        width: textWidth,
        align: hasQr ? 'left' : 'center',
        link: paymentUrl,
        underline: true
      });
      
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#4b5563');
      doc.text('Click the link above or scan the QR code to complete your payment', textX, paymentTextY + 52, { // Increased spacing
        width: textWidth,
        align: hasQr ? 'left' : 'center'
      });
      
      y = paymentBoxY + paymentBoxHeight + 36; // Increased spacing after payment box

      // ========================================================================
      // SECTION 7: FOOTER SECTION
      // ========================================================================
      const footerY = y;
      
      // Border top
      doc.strokeColor('#e5e7eb');
      doc.lineWidth(1);
      doc.moveTo(margin, y + 3);
      doc.lineTo(pageWidth - margin, y + 3);
      doc.stroke();
      
      y += 32; // Increased spacing after footer border
      
      // Status and disclaimer (left side)
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.fillColor('#374151');
      const statusText = `Status: ${(quote.quoteStatus || 'pending').charAt(0).toUpperCase() + (quote.quoteStatus || 'pending').slice(1)}`;
      doc.text(statusText, margin, y);
      
      if (isRange) {
        y += 20; // Increased spacing after status
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        const disclaimerText = 'This is an estimate based on your selected employee range and may vary based on final requirements.';
        doc.text(disclaimerText, margin, y, {
          width: contentWidth / 2,
          align: 'left'
        });
      }
      
      // XS Card branding (right side) - positioned below border line, same Y as Status
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.fillColor('#374151');
      const brandingText = 'XS Card';
      const brandingWidth = doc.widthOfString(brandingText);
      doc.text(brandingText, pageWidth - margin - brandingWidth, y);
      
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#4b5563');
      const enterpriseText = 'Enterprise Solutions';
      const enterpriseWidth = doc.widthOfString(enterpriseText);
      doc.text(enterpriseText, pageWidth - margin - enterpriseWidth, y + 20); // Increased spacing

      // ========================================================================
      // SECTION 8: CLICKABLE LINK OVERLAY (82% down the page)
      // ========================================================================
      const linkYPercent = 0.82;
      const linkY = pageHeight * linkYPercent;
      const linkX = margin;
      const linkWidth = contentWidth;
      const linkHeight = mmToPoints(12); // 12mm height
      
      doc.link(linkX, linkY - linkHeight, linkWidth, linkHeight, {
        url: paymentUrl
      });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateQuotePDF,
  formatDate,
  getQuotePaymentEntryUrl,
  formatEmployeeCount
};
