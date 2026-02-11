/**
 * Invoice/Receipt PDF Generator
 * 
 * Generates professional invoices and receipts for enterprise subscriptions.
 * Matches the sample receipt layout exactly.
 */

const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { getCompanyInfo } = require('./companyInfo');

/**
 * Format date as "DD Month YYYY" (e.g., "4 February 2026")
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  // Handle Firestore Timestamp objects
  let date;
  if (dateString && typeof dateString.toDate === 'function') {
    date = dateString.toDate();
  } else if (typeof dateString === 'string') {
    date = new Date(dateString);
  } else {
    date = new Date(dateString);
  }
  
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format price from cents to currency string
 */
function formatPrice(amountInCents, currency = 'ZAR') {
  const amount = amountInCents / 100;
  const symbol = currency === 'USD' ? 'US$' : 'R';
  return `${symbol}${amount.toFixed(2)}`;
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
 * Format billing address as multi-line string
 */
function formatBillingAddress(address) {
  if (!address) return '';
  
  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.building) parts.push(address.building);
  
  const cityParts = [];
  if (address.city) cityParts.push(address.city);
  if (address.province) cityParts.push(address.province);
  if (address.postalCode) cityParts.push(address.postalCode);
  if (cityParts.length > 0) parts.push(cityParts.join(', '));
  
  if (address.country) parts.push(address.country);
  
  return parts.join('\n');
}

/**
 * Generate invoice/receipt PDF
 * 
 * @param {Object} invoice - Invoice/Receipt data object
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateInvoicePDF(invoice) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get company info from environment variables
      const companyInfo = getCompanyInfo();
      
      // Calculate PDF dimensions (A4)
      const pageWidthMM = 210;
      const pageHeightMM = 297;
      
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
      
      // Margins
      const marginMM = 8;
      const margin = mmToPoints(marginMM);
      
      // Starting position
      let y = margin;
      const contentWidth = pageWidth - (margin * 2);
      
      const isReceipt = invoice.isReceipt || false;
      const title = isReceipt ? 'Receipt' : 'Invoice';

      // ========================================================================
      // SECTION 1: HEADER - Logo (LEFT) and Company Info (LEFT after logo)
      // ========================================================================
      const headerY = y;
      
      // Logo space on LEFT (reserved for logo)
      const logoSpaceWidth = mmToPoints(40); // 40mm width for logo
      const logoSize = mmToPoints(30); // Actual logo size (30mm)
      const logoX = margin;
      const logoY = y;
      
      // Try to load logo from common locations
      const logoPaths = [
        path.join(__dirname, '..', 'public', 'logo.png'),
        path.join(__dirname, '..', 'public', 'xs-logo.png'),
        path.join(__dirname, '..', 'assets', 'logo.png'),
        invoice.logoPath,
        companyInfo.logoPath
      ].filter(Boolean);
      
      let logoLoaded = false;
      for (const logoPath of logoPaths) {
        try {
          if (logoPath && fs.existsSync(logoPath)) {
            doc.image(logoPath, logoX, logoY, {
              width: logoSize,
              height: logoSize,
              fit: [logoSize, logoSize]
            });
            logoLoaded = true;
            break;
          }
        } catch (logoError) {
          // Try next path
          continue;
        }
      }
      
      if (!logoLoaded) {
        console.warn('Logo not found. Please place logo.png in backend/public/');
      }
      
      // Company info on LEFT (after logo space)
      const companyInfoX = margin + logoSpaceWidth;
      y = headerY;
      
      doc.font('Helvetica-Bold');
      doc.fontSize(16);
      doc.fillColor('#111827');
      doc.text(companyInfo.name || 'XS Card', companyInfoX, y);
      
      y += 20;
      
      // Company address
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.fillColor('#374151');
      const addressLines = [
        companyInfo.address.street,
        `${companyInfo.address.city}, ${companyInfo.address.province || ''} ${companyInfo.address.postalCode}`.trim(),
        companyInfo.address.country
      ].filter(Boolean);
      
      addressLines.forEach((line, index) => {
        doc.text(line, companyInfoX, y + (index * 14));
      });
      
      y += addressLines.length * 14 + 8;
      
      // Phone
      if (companyInfo.phone) {
        doc.text(companyInfo.phone, companyInfoX, y);
        y += 14;
      }
      
      // Email
      if (companyInfo.email) {
        doc.text(companyInfo.email, companyInfoX, y);
        y += 14;
      }
      
      // VAT number
      if (companyInfo.vatNumber) {
        doc.text(`VAT: ${companyInfo.vatNumber}`, companyInfoX, y);
        y += 14;
      }
      
      y = Math.max(y, headerY + logoSize) + 24; // Ensure minimum header height matches logo

      // ========================================================================
      // SECTION 2: TITLE SECTION
      // ========================================================================
      doc.font('Helvetica-Bold');
      doc.fontSize(24);
      doc.fillColor('#111827');
      doc.text(title, margin, y);
      
      y += 30;
      
      // Receipt/Invoice number
      doc.font('Helvetica');
      doc.fontSize(12);
      doc.fillColor('#4b5563');
      
      const numberLabel = isReceipt ? 'Receipt number:' : 'Invoice number:';
      const numberValue = isReceipt ? (invoice.receiptNumber || 'N/A') : (invoice.invoiceNumber || 'N/A');
      doc.text(numberLabel, margin, y);
      doc.font('Helvetica-Bold');
      doc.text(numberValue, margin + doc.widthOfString(numberLabel + ' '), y);
      
      y += 18;
      
      // Date paid (receipts) or Due date (invoices)
      if (isReceipt && invoice.datePaid) {
        doc.font('Helvetica');
        doc.text(`Date paid: ${formatDate(invoice.datePaid)}`, margin, y);
        y += 18;
      }
      
      // Cycle (for receipts)
      if (isReceipt && invoice.cycle) {
        doc.font('Helvetica');
        doc.text(`Cycle: ${invoice.cycle}`, margin, y);
        y += 18;
      }
      
      y += 12;

      // ========================================================================
      // SECTION 3: BILL TO (LEFT) AND SUMMARY (RIGHT) - SIDE BY SIDE
      // ========================================================================
      const twoColumnY = y;
      const columnWidth = (contentWidth - mmToPoints(10)) / 2; // 10mm gap between columns
      
      // BILL TO - Left column
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      doc.fillColor('#111827');
      doc.text('BILL TO', margin, y);
      
      y += 18;
      
      // Calculate dynamic height for Bill To box
      const billToBoxY = y;
      const billToPadding = 20; // Top and bottom padding
      const lineSpacing = 20; // Spacing between elements
      
      // Set fonts for measurement
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      const companyNameHeight = invoice.billTo?.companyName ? 16 : 0;
      
      doc.font('Helvetica');
      doc.fontSize(12);
      const emailHeight = invoice.billTo?.contactEmail ? 12 : 0;
      
      doc.fontSize(10);
      let addressHeight = 0;
      if (invoice.billTo?.address) {
        const addressText = formatBillingAddress(invoice.billTo.address);
        if (addressText) {
          addressHeight = doc.heightOfString(addressText, {
            width: columnWidth - 24
          });
        }
      }
      
      const vatHeight = invoice.billTo?.vatNumber ? 10 : 0;
      
      // Calculate total height
      let billToContentHeight = billToPadding; // Top padding
      if (companyNameHeight > 0) billToContentHeight += companyNameHeight;
      if (emailHeight > 0) billToContentHeight += lineSpacing + emailHeight;
      if (addressHeight > 0) billToContentHeight += lineSpacing + addressHeight;
      if (vatHeight > 0) billToContentHeight += lineSpacing + vatHeight;
      billToContentHeight += billToPadding; // Bottom padding
      
      const billToBoxHeight = billToContentHeight;
      
      // Draw box background
      doc.save();
      doc.fillColor('#f9fafb');
      drawRoundedRect(doc, margin, y, columnWidth, billToBoxHeight, 8);
      doc.fill();
      doc.restore();
      
      // Draw content
      const billToContentY = billToBoxY + billToPadding;
      let currentBillToY = billToContentY;
      
      // Company name
      if (invoice.billTo?.companyName) {
        doc.font('Helvetica-Bold');
        doc.fontSize(14);
        doc.fillColor('#111827');
        doc.text(invoice.billTo.companyName, margin + 12, currentBillToY);
        currentBillToY += companyNameHeight;
      }
      
      // Email
      if (invoice.billTo?.contactEmail) {
        currentBillToY += lineSpacing;
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        doc.text(invoice.billTo.contactEmail, margin + 12, currentBillToY);
        currentBillToY += emailHeight;
      }
      
      // Billing address
      if (invoice.billTo?.address) {
        const addressText = formatBillingAddress(invoice.billTo.address);
        if (addressText) {
          currentBillToY += lineSpacing;
          doc.font('Helvetica');
          doc.fontSize(10);
          doc.fillColor('#4b5563');
          doc.text(addressText, margin + 12, currentBillToY, {
            width: columnWidth - 24,
            align: 'left'
          });
          currentBillToY += addressHeight;
        }
      }
      
      // VAT number
      if (invoice.billTo?.vatNumber) {
        currentBillToY += lineSpacing;
        doc.font('Helvetica');
        doc.fontSize(10);
        doc.fillColor('#4b5563');
        doc.text(`VAT: ${invoice.billTo.vatNumber}`, margin + 12, currentBillToY);
      }
      
      // SUMMARY - Right column
      const summaryX = margin + columnWidth + mmToPoints(10);
      y = twoColumnY;
      
      doc.font('Helvetica-Bold');
      doc.fontSize(14);
      doc.fillColor('#111827');
      doc.text('SUMMARY', summaryX, y);
      
      y += 18;
      
      // Summary box
      const summaryBoxY = y;
      const summaryBoxHeight = 100;
      
      doc.save();
      doc.fillColor('#f9fafb');
      drawRoundedRect(doc, summaryX, y, columnWidth, summaryBoxHeight, 8);
      doc.fill();
      doc.restore();
      
      const summaryContentY = summaryBoxY + 20;
      
      // Summary content - different for receipts vs invoices
      if (isReceipt && invoice.paymentMethod) {
        // Receipt: Show payment method
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        doc.text('Payment method:', summaryX + 12, summaryContentY);
        doc.font('Helvetica-Bold');
        doc.text(invoice.paymentMethod, summaryX + 12, summaryContentY + 18);
      } else if (!isReceipt) {
        // Invoice: Show amount due and payment terms
        doc.font('Helvetica');
        doc.fontSize(12);
        doc.fillColor('#4b5563');
        doc.text('Amount due:', summaryX + 12, summaryContentY);
        doc.font('Helvetica-Bold');
        doc.fontSize(16);
        doc.fillColor('#111827');
        const amountDue = formatPrice(invoice.total || 0, invoice.currency);
        doc.text(amountDue, summaryX + 12, summaryContentY + 18);
        
        // Payment terms (if due date exists)
        if (invoice.dueDate) {
          doc.font('Helvetica');
          doc.fontSize(10);
          doc.fillColor('#6b7280');
          const daysUntilDue = Math.ceil((new Date(invoice.dueDate).getTime() - (invoice.invoiceDate ? new Date(invoice.invoiceDate).getTime() : Date.now())) / (1000 * 60 * 60 * 24));
          doc.text(`Payment due in ${daysUntilDue} days`, summaryX + 12, summaryContentY + 40);
        }
      }
      
      y = Math.max(billToBoxY + billToBoxHeight, summaryBoxY + summaryBoxHeight) + 24;

      // ========================================================================
      // SECTION 4: LINE ITEMS TABLE (FULL WIDTH)
      // ========================================================================
      const tableY = y;
      const rowHeight = 30;
      const col1Width = contentWidth * 0.5; // Description
      const col2Width = contentWidth * 0.15; // Qty
      const col3Width = contentWidth * 0.175; // Unit price
      const col4Width = contentWidth * 0.175; // Amount
      
      // Table header
      doc.font('Helvetica-Bold');
      doc.fontSize(10);
      doc.fillColor('#374151');
      doc.text('Description', margin, tableY);
      doc.text('Qty', margin + col1Width, tableY);
      doc.text('Unit price', margin + col1Width + col2Width, tableY);
      doc.text('Amount', margin + col1Width + col2Width + col3Width, tableY);
      
      // Header underline
      y = tableY + 16;
      doc.strokeColor('#e5e7eb');
      doc.lineWidth(1);
      doc.moveTo(margin, y);
      doc.lineTo(pageWidth - margin, y);
      doc.stroke();
      
      y += 12;
      
      // Line items
      if (invoice.lineItems && invoice.lineItems.length > 0) {
        invoice.lineItems.forEach((item, index) => {
          const itemY = y + (index * rowHeight);
          
          // Description
          doc.font('Helvetica');
          doc.fontSize(10);
          doc.fillColor('#111827');
          doc.text(item.description || 'N/A', margin, itemY, {
            width: col1Width - 8,
            align: 'left'
          });
          
          // Quantity
          doc.text(String(item.quantity || 1), margin + col1Width, itemY);
          
          // Unit price
          const unitPrice = formatPrice(item.unitPrice || 0, invoice.currency);
          doc.text(unitPrice, margin + col1Width + col2Width, itemY);
          
          // Amount
          doc.font('Helvetica-Bold');
          const amount = formatPrice(item.amount || item.unitPrice || 0, invoice.currency);
          doc.text(amount, margin + col1Width + col2Width + col3Width, itemY);
        });
        
        y += invoice.lineItems.length * rowHeight;
      }
      
      y += 12;
      
      // Totals section
      const totalsY = y;
      
      // Subtotal
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.fillColor('#4b5563');
      doc.text('Subtotal', margin + col1Width + col2Width, totalsY);
      doc.font('Helvetica-Bold');
      doc.text(formatPrice(invoice.subtotal || invoice.total || 0, invoice.currency), 
               margin + col1Width + col2Width + col3Width, totalsY);
      
      // Total
      y += 16;
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.fillColor('#111827');
      doc.text('Total', margin + col1Width + col2Width, y);
      doc.text(formatPrice(invoice.total || 0, invoice.currency), 
               margin + col1Width + col2Width + col3Width, y);
      
      // Amount paid (receipts) or Amount due (invoices)
      if (isReceipt) {
        y += 16;
        doc.font('Helvetica-Bold');
        doc.fontSize(12);
        doc.fillColor('#111827');
        doc.text('Amount paid', margin + col1Width + col2Width, y);
        doc.text(formatPrice(invoice.amountPaid || invoice.total || 0, invoice.currency), 
                 margin + col1Width + col2Width + col3Width, y);
      } else {
        // For invoices, show amount due
        y += 16;
        doc.font('Helvetica-Bold');
        doc.fontSize(12);
        doc.fillColor('#111827');
        doc.text('Amount due', margin + col1Width + col2Width, y);
        doc.text(formatPrice(invoice.total || 0, invoice.currency), 
                 margin + col1Width + col2Width + col3Width, y);
      }
      
      // Currency conversion (if applicable)
      if (invoice.currencyConversion) {
        y += 16;
        doc.font('Helvetica');
        doc.fontSize(10);
        doc.fillColor('#4b5563');
        doc.text(invoice.currencyConversion, margin, y);
      }
      
      y += 30;

      // ========================================================================
      // SECTION 5: FOOTER SECTION - COMPANY INFO
      // ========================================================================
      // Border top
      doc.strokeColor('#e5e7eb');
      doc.lineWidth(1);
      doc.moveTo(margin, y + 3);
      doc.lineTo(pageWidth - margin, y + 3);
      doc.stroke();
      
      y += 19;
      
      // Company name
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.fillColor('#111827');
      doc.text(companyInfo.name || 'XS Card', margin, y);
      
      y += 16;
      
      // Company address
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.fillColor('#374151');
      const footerAddressLines = [
        companyInfo.address.street,
        `${companyInfo.address.city}, ${companyInfo.address.province || ''} ${companyInfo.address.postalCode}`.trim(),
        companyInfo.address.country
      ].filter(Boolean);
      
      footerAddressLines.forEach((line, index) => {
        doc.text(line, margin, y + (index * 12));
      });
      
      y += footerAddressLines.length * 12 + 8;
      
      // Phone
      if (companyInfo.phone) {
        doc.text(companyInfo.phone, margin, y);
        y += 12;
      }
      
      // Email
      if (companyInfo.email) {
        doc.text(companyInfo.email, margin, y);
        y += 12;
      }
      
      // VAT number
      if (companyInfo.vatNumber) {
        doc.text(`VAT: ${companyInfo.vatNumber}`, margin, y);
      }
      
      // Finalize PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoicePDF
};
