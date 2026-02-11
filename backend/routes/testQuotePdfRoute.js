/**
 * Test Quote PDF Route
 * 
 * ONE-TIME TEST ENDPOINT with mock data.
 * Remove after testing is complete.
 */

const express = require('express');
const router = express.Router();
const { generateQuotePDF } = require('../utils/quotePdfGenerator');
const { generateInvoicePDF } = require('../utils/invoicePdfGenerator');
const { formatPrice } = require('../config/enterprisePricing');

/**
 * GET /test/quote-pdf
 * 
 * Generates a test PDF with mock quote data.
 */
router.get('/quote-pdf', async (req, res) => {
  try {
    // Mock quote data matching the spec
    const mockQuote = {
      quoteId: 'quote_1770283565537_test123',
      companyName: 'Test Company Inc',
      contactName: 'John Doe',
      contactEmail: 'john@testcompany.com',
      numberOfEmployees: 250, // Can also test with "201-1000" for range
      calculatedPrice: 260000, // R2,600.00 in cents
      formattedPrice: 'R 2,600.00',
      currency: 'ZAR',
      quoteStatus: 'pending',
      subscriptionType: 'yearly',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      // Optional: Add priceRange for range testing
      // priceRange: {
      //   minEmployees: 201,
      //   maxEmployees: 1000,
      //   minPrice: 211000,
      //   maxPrice: 1010000,
      //   midEmployees: 600,
      //   midPrice: 610000,
      //   formattedMinPrice: 'R 2,110.00',
      //   formattedMaxPrice: 'R 10,100.00'
      // }
    };

    // Get base URL
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:8383';
    const baseUrl = `${protocol}://${host}`;

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(mockQuote, baseUrl);

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `XS_Card_Quote_${mockQuote.quoteId}_${date}.pdf`;

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating test PDF:', error);
    res.status(500).json({
      success: false,
      error: 'PDF generation failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /test/quote-pdf-range
 * 
 * Generates a test PDF with mock quote data (range-based pricing).
 */
router.get('/quote-pdf-range', async (req, res) => {
  try {
    // Mock quote data with price range
    const mockQuote = {
      quoteId: 'quote_1770283565537_range_test',
      companyName: 'Large Enterprise Corp',
      contactName: 'Jane Smith',
      contactEmail: 'jane@largeenterprise.com',
      numberOfEmployees: '201-1000', // Range string
      calculatedPrice: 610000, // Mid-point price in cents
      formattedPrice: 'R 6,100.00',
      currency: 'ZAR',
      quoteStatus: 'pending',
      subscriptionType: 'yearly',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      priceRange: {
        minEmployees: 201,
        maxEmployees: 1000,
        minPrice: 211000,
        maxPrice: 1010000,
        midEmployees: 600,
        midPrice: 610000,
        formattedMinPrice: 'R 2,110.00',
        formattedMaxPrice: 'R 10,100.00'
      }
    };

    // Get base URL
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:8383';
    const baseUrl = `${protocol}://${host}`;

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(mockQuote, baseUrl);

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `XS_Card_Quote_${mockQuote.quoteId}_${date}.pdf`;

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating test PDF:', error);
    res.status(500).json({
      success: false,
      error: 'PDF generation failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /test/invoice-pdf
 * 
 * Generates a test PDF with mock invoice/receipt data matching the sample receipt.
 */
router.get('/invoice-pdf', async (req, res) => {
  try {
    // Mock invoice/receipt data matching the sample receipt structure
    const mockInvoice = {
      invoiceId: 'inv_test_123',
      invoiceNumber: 'INV-2026-001',
      receiptNumber: '2736-3055',
      isReceipt: true,
      invoiceStatus: 'paid',
      currency: 'USD',
      
      // Dates
      invoiceDate: new Date('2026-01-22'),
      datePaid: new Date('2026-02-04'),
      cycle: '22 January 2026 --',
      
      // Bill To
      billTo: {
        companyName: 'X Spark',
        contactName: '',
        contactEmail: 'xsparkatx@gmail.com',
        address: {
          street: '546 16th Road',
          building: 'Building 2, Randjespark',
          city: 'Midrand',
          province: '',
          postalCode: '1685',
          country: 'South Africa'
        },
        vatNumber: 'ZA VAT 4610232680'
      },
      
      // Line Items
      lineItems: [{
        description: 'Cursor Usage for cycle starting January 22, 2026 – 517 token-based usage calls to non-max-default',
        quantity: 1,
        unitPrice: 2022, // US$20.22 in cents
        amount: 2022
      }],
      
      // Pricing
      subtotal: 2022,
      tax: 0,
      total: 2022,
      amountPaid: 2022,
      
      // Payment
      paymentMethod: 'Visa - 4043',
      paymentReference: 'pay_test_123',
      
      // Currency conversion
      currencyConversion: 'Charged R334.87 using 1 USD = 16.5612 ZAR'
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(mockInvoice);

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `XS_Card_Receipt_${mockInvoice.receiptNumber}_${date}.pdf`;

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating test invoice PDF:', error);
    res.status(500).json({
      success: false,
      error: 'PDF generation failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /test/invoice-pdf-invoice
 * 
 * Generates a test PDF with mock INVOICE data (not receipt - before payment).
 */
router.get('/invoice-pdf-invoice', async (req, res) => {
  try {
    // Mock INVOICE data (isReceipt: false - before payment)
    const mockInvoice = {
      invoiceId: 'inv_test_456',
      invoiceNumber: 'INV-2026-002',
      isReceipt: false, // This is an INVOICE, not a receipt
      invoiceStatus: 'sent', // unpaid/pending
      currency: 'ZAR',
      
      // Dates - invoice date and due date (30 days from invoice date)
      invoiceDate: new Date('2026-02-01'),
      dueDate: new Date('2026-03-03'), // 30 days later
      
      // Bill To
      billTo: {
        companyName: 'Acme Corporation',
        contactName: 'Jane Smith',
        contactEmail: 'jane@acmecorp.com',
        address: {
          street: '123 Business Street',
          building: 'Suite 500',
          city: 'Johannesburg',
          province: 'Gauteng',
          postalCode: '2000',
          country: 'South Africa'
        },
        vatNumber: 'ZA VAT 1234567890'
      },
      
      // Line Items
      lineItems: [{
        description: 'XSCard Enterprise License for 250 employees - yearly subscription',
        quantity: 1,
        unitPrice: 260000, // R2,600.00 in cents
        amount: 260000
      }],
      
      // Pricing
      subtotal: 260000,
      tax: 0,
      total: 260000
      // No amountPaid, paymentMethod, or datePaid - this is an invoice!
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(mockInvoice);

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `XS_Card_Invoice_${mockInvoice.invoiceNumber}_${date}.pdf`;

    // Set headers and send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating test invoice PDF:', error);
    res.status(500).json({
      success: false,
      error: 'PDF generation failed',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
