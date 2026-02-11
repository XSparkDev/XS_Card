# Enterprise Quote PDF Generation Specification

This document provides the complete frontend implementation details for the Enterprise Quote PDF, so the backend can generate an **identical** PDF server-side.

---

## 1. Current Frontend Implementation

### 1.1. Technology Stack
- **Library**: `jsPDF` (v2.x) + `html2canvas` (v2.x)
- **Method**: HTML → Canvas → PDF
- **Page Size**: Dynamic (A4 width: 210mm, height calculated from content)
- **Orientation**: Portrait if height > width, otherwise landscape
- **Scale**: 2x (for high-quality rendering)
- **Background**: White (#ffffff)

### 1.2. PDF Generation Flow

```typescript
// Current frontend code (app/page.tsx, lines 666-741)
const handleDownloadQuotePdf = async () => {
  // 1. Capture HTML element as canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  // 2. Calculate PDF dimensions (A4 width: 210mm)
  const imgWidth = 210 // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  // 3. Create PDF
  const pdf = new jsPDF({
    orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
    unit: 'mm',
    format: [imgWidth, imgHeight]
  })

  // 4. Add image to PDF
  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)

  // 5. Add clickable link overlay (for payment URL)
  if (enterpriseQuote.quoteId) {
    const linkYPercent = 0.82 // 82% down the page
    const linkY = imgHeight * linkYPercent
    const linkX = 15 // Left margin (mm)
    const linkWidth = imgWidth - 30 // Full width minus margins
    const linkHeight = 12 // Height of clickable area (mm)
    
    // Convert mm to points (1mm = 2.83465 points)
    const pageHeightPoints = pdf.internal.pageSize.getHeight()
    const linkYPoints = pageHeightPoints - (linkY * 2.83465)
    const linkXPoints = linkX * 2.83465
    const linkWidthPoints = linkWidth * 2.83465
    const linkHeightPoints = linkHeight * 2.83465
    
    pdf.link(linkXPoints, linkYPoints - linkHeightPoints, linkWidthPoints, linkHeightPoints, {
      url: getQuotePaymentEntryUrl(enterpriseQuote.quoteId)
    })
  }

  // 6. Generate filename
  const filename = `XS_Card_Quote_${enterpriseQuote.quoteId}_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(filename)
}
```

---

## 2. HTML Template (JSX/TSX)

The quote preview is rendered inside a `div` with `ref={quotePdfRef}`. Here is the **exact JSX template**:

```tsx
<div className="relative bg-white rounded-lg mx-3 my-3 shadow-2xl flex-1 overflow-y-auto">
  {/* Watermark */}
  <div 
    className="absolute inset-0 pointer-events-none flex items-center justify-center"
    style={{
      opacity: 0.08,
      transform: 'rotate(-45deg)',
      fontSize: '6rem',
      fontWeight: 'bold',
      color: '#000',
      userSelect: 'none',
    }}
  >
    QUOTE
  </div>

  {/* PDF Content */}
  <div className="relative min-h-full p-6 md:p-8 flex flex-col text-gray-900">
    {/* Header */}
    <div className="mb-6 pb-4 border-b-2 border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Enterprise Quote</h1>
          <p className="text-xs text-gray-600">XS Card Digital Business Card Solution</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Quote ID</p>
          <p className="text-xs font-mono font-semibold text-gray-900 break-all">{quote.quoteId}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>
          <span className="font-semibold">Date:</span>{" "}
          {formatDate(quote.createdAt)}
        </span>
        <span>•</span>
        <span>
          <span className="font-semibold">Valid Until:</span>{" "}
          {formatDate(quote.expiresAt)}
        </span>
      </div>
    </div>

    {/* Company Information */}
    <div className="mb-6">
      <h2 className="text-base font-semibold text-gray-900 mb-2">Prepared For</h2>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="font-semibold text-gray-900">{quote.companyName}</p>
        <p className="text-gray-700 text-sm mt-1">{quote.contactName}</p>
        <p className="text-gray-600 text-xs mt-1">{quote.contactEmail}</p>
      </div>
    </div>

    {/* Pricing Section */}
    <div className="mb-6 flex-1">
      <h2 className="text-base font-semibold text-gray-900 mb-3">
        {typeof quote.numberOfEmployees === "string"
          ? "Pricing Estimate"
          : "Pricing"}
      </h2>
      
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs text-gray-600 uppercase tracking-wide">
            {typeof quote.numberOfEmployees === "string"
              ? "Estimated Yearly Price"
              : "Yearly Price"}
          </p>
          <p className="text-3xl font-bold text-gray-900">{quote.formattedPrice}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
          <span>
            {typeof quote.numberOfEmployees === "string"
              ? `${quote.numberOfEmployees} employees`
              : typeof quote.numberOfEmployees === "number"
              ? `${quote.numberOfEmployees.toLocaleString()} employees`
              : "N/A employees"}
          </span>
          <span className="uppercase text-xs">
            {quote.currency} • {quote.subscriptionType}
          </span>
        </div>
      </div>

      {quote.priceRange && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">Price Range Estimate</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-600">Minimum</p>
              <p className="font-semibold text-gray-900">{quote.priceRange.formattedMinPrice}</p>
              <p className="text-xs text-gray-500 mt-1">{quote.priceRange.minEmployees} employees</p>
            </div>
            <div>
              <p className="text-gray-600">Maximum</p>
              <p className="font-semibold text-gray-900">{quote.priceRange.formattedMaxPrice}</p>
              <p className="text-xs text-gray-500 mt-1">{quote.priceRange.maxEmployees} employees</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
            Mid-point: {quote.priceRange.formattedMinPrice} – {quote.priceRange.formattedMaxPrice} 
            for {quote.priceRange.minEmployees}–{quote.priceRange.maxEmployees} employees
          </p>
        </div>
      )}
    </div>

    {/* Payment Section */}
    <div className="mb-6 pt-4 border-t border-gray-200">
      <h2 className="text-base font-semibold text-gray-900 mb-3">Proceed to Payment</h2>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
          {qrCodeDataUrl && (
            <div className="flex-shrink-0">
              <img 
                src={qrCodeDataUrl} 
                alt="Payment QR Code" 
                className="w-32 h-32 border-2 border-gray-200 rounded-lg bg-white p-2"
              />
              <p className="text-xs text-gray-600 text-center mt-2">Scan to pay</p>
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-semibold text-gray-900 mb-2">Ready to proceed with payment</p>
            <a
              href={paymentEntryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-600 hover:text-blue-800 underline break-all cursor-pointer relative z-10"
            >
              {paymentEntryUrl}
            </a>
            <p className="text-xs text-gray-600 mt-2">
              Click the link above or scan the QR code to complete your payment
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="mt-auto pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>
          <p className="font-semibold text-gray-700 mb-1">
            Status: <span className="capitalize text-gray-900">{quote.quoteStatus}</span>
          </p>
          {typeof quote.numberOfEmployees === "string" && (
            <p className="text-xs">
              This is an estimate based on your selected employee range and may vary based on final requirements.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-700">XS Card</p>
          <p className="text-xs">Enterprise Solutions</p>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 3. CSS Classes & Styling

The template uses **Tailwind CSS** classes. Here's the mapping to actual CSS:

### 3.1. Layout & Spacing
- `p-6 md:p-8` = padding: 1.5rem (24px) on mobile, 2rem (32px) on md+
- `mb-6` = margin-bottom: 1.5rem (24px)
- `gap-4` = gap: 1rem (16px)
- `flex flex-col` = display: flex, flex-direction: column

### 3.2. Colors
- `bg-white` = background: #ffffff
- `text-gray-900` = color: #111827
- `text-gray-700` = color: #374151
- `text-gray-600` = color: #4b5563
- `text-gray-500` = color: #6b7280
- `bg-gray-50` = background: #f9fafb
- `border-gray-200` = border-color: #e5e7eb
- `from-purple-50 to-blue-50` = gradient from #faf5ff to #eff6ff
- `from-green-50 to-emerald-50` = gradient from #f0fdf4 to #ecfdf5
- `text-blue-600` = color: #2563eb
- `text-blue-800` = color: #1e40af

### 3.3. Typography
- `text-2xl` = font-size: 1.5rem (24px), line-height: 2rem
- `text-base` = font-size: 1rem (16px), line-height: 1.5rem
- `text-xs` = font-size: 0.75rem (12px), line-height: 1rem
- `text-3xl` = font-size: 1.875rem (30px), line-height: 2.25rem
- `font-bold` = font-weight: 700
- `font-semibold` = font-weight: 600
- `font-mono` = font-family: ui-monospace, monospace
- `uppercase` = text-transform: uppercase
- `tracking-wide` = letter-spacing: 0.025em

### 3.4. Borders & Rounded Corners
- `rounded-lg` = border-radius: 0.5rem (8px)
- `border-b-2` = border-bottom-width: 2px
- `border-t` = border-top-width: 1px
- `border-2` = border-width: 2px

### 3.5. Gradients
- `bg-gradient-to-br` = background-image: linear-gradient(to bottom right, ...)

### 3.6. Watermark
- Position: absolute, full container
- Opacity: 0.08 (8%)
- Transform: rotate(-45deg)
- Font size: 6rem (96px)
- Font weight: bold
- Color: #000000
- Centered (flex items-center justify-center)

---

## 4. Helper Functions

### 4.1. Date Formatting

```typescript
// Format: "DD Month YYYY" (e.g., "27 January 2025")
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
```

**Examples:**
- `2025-01-27T10:30:00.000Z` → `"27 January 2025"`
- `2026-02-26T10:30:00.000Z` → `"26 February 2026"`

### 4.2. Payment Entry URL

```typescript
function getQuotePaymentEntryUrl(quoteId: string): string {
  // API_BASE_URL is the backend base URL (e.g., "http://localhost:8383" or "https://baseUrl.xscard.co.za")
  return `${API_BASE_URL}/pay/quote/${encodeURIComponent(quoteId)}`
}
```

**Examples:**
- Development: `http://localhost:8383/pay/quote/quote_1769585842554_5lkq2lvby`
- Production: `https://baseUrl.xscard.co.za/pay/quote/quote_1769585842554_5lkq2lvby`

### 4.3. Number Formatting

```typescript
// Format employee count with thousand separators
function formatEmployeeCount(count: number | string): string {
  if (typeof count === "string") {
    return `${count} employees` // e.g., "201-1000 employees"
  }
  if (typeof count === "number") {
    return `${count.toLocaleString()} employees` // e.g., "1,234 employees"
  }
  return "N/A employees"
}
```

**Examples:**
- `250` → `"250 employees"`
- `1234` → `"1,234 employees"`
- `"201-1000"` → `"201-1000 employees"`

### 4.4. QR Code Generation

The frontend uses the `qrcode` library (npm: `qrcode`):

```typescript
import QRCode from 'qrcode'

async function generateQRCode(url: string): Promise<string> {
  // Returns a data URL (base64 PNG)
  return await QRCode.toDataURL(url, {
    width: 128, // 128x128 pixels
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })
}
```

**QR Code Specifications:**
- Size: 128x128 pixels (displayed as `w-32 h-32` = 128px)
- Error correction: Default (usually M)
- Format: PNG data URL (base64)
- Border: 2px gray (#e5e7eb), rounded corners (8px), white padding (8px)

---

## 5. Conditional Logic

### 5.1. Pricing Section Title
- If `numberOfEmployees` is a **string** (range): Show `"Pricing Estimate"`
- If `numberOfEmployees` is a **number** (exact): Show `"Pricing"`

### 5.2. Price Label
- If `numberOfEmployees` is a **string**: Show `"Estimated Yearly Price"`
- If `numberOfEmployees` is a **number**: Show `"Yearly Price"`

### 5.3. Footer Disclaimer
- **Only show** if `numberOfEmployees` is a **string** (range):
  - Text: `"This is an estimate based on your selected employee range and may vary based on final requirements."`
- **Hide** if `numberOfEmployees` is a **number** (exact count)

### 5.4. Price Range Section
- **Only show** if `quote.priceRange` exists (i.e., when `numberOfEmployees` is a range string)

---

## 6. Data Structure

### 6.1. Quote Object (from `POST /api/enterprise/quote`)

```typescript
interface EnterpriseQuote {
  quoteId: string
  companyName: string
  contactName: string
  contactEmail: string
  numberOfEmployees: number | string // Integer OR range string like "201-1000"
  calculatedPrice: number // in cents
  formattedPrice: string // e.g., "R 6,600.00"
  currency: string // e.g., "ZAR"
  quoteStatus: string // "pending" | "accepted" | "paid" | "expired"
  subscriptionType: string // "yearly" | "monthly"
  createdAt: string // ISO 8601 timestamp
  expiresAt: string // ISO 8601 timestamp
  priceRange?: {
    minEmployees: number
    maxEmployees: number
    minPrice: number // in cents
    maxPrice: number // in cents
    midEmployees: number
    midPrice: number // in cents
    formattedMinPrice: string // e.g., "R 210.00"
    formattedMaxPrice: string // e.g., "R 1,000.00"
  }
}
```

---

## 7. PDF Filename Format

```typescript
const filename = `XS_Card_Quote_${quote.quoteId}_${new Date().toISOString().split('T')[0]}.pdf`
```

**Examples:**
- `XS_Card_Quote_quote_1769585842554_5lkq2lvby_2025-01-27.pdf`

---

## 8. Recommended Backend Implementation

### 8.1. Option A: HTML-to-PDF (Puppeteer/Playwright)

**Pros:**
- Exact visual match (uses browser rendering)
- Easy to reuse the same HTML/CSS
- Handles gradients, rounded corners, and complex layouts automatically

**Steps:**
1. Create an HTML template file (or JSX → HTML converter) with the exact structure above
2. Use Tailwind CSS (or convert Tailwind classes to inline styles/CSS)
3. Render the template with quote data
4. Use Puppeteer/Playwright to:
   - Load the HTML in a headless browser
   - Capture as PDF (or screenshot → PDF)
   - Add clickable link overlay for payment URL

**Example (Puppeteer):**
```javascript
const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.setContent(htmlTemplate)
await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' }
})
```

### 8.2. Option B: PDF Library (pdfkit/pdf-lib)

**Pros:**
- More control over PDF structure
- Smaller file size
- Better for programmatic PDFs

**Cons:**
- Need to manually recreate all styling
- More complex for gradients and rounded corners

**Steps:**
1. Port each visual element to PDF drawing commands
2. Match exact coordinates, fonts, sizes, colors
3. Add clickable link annotation for payment URL

---

## 9. Backend Endpoint Specification

### 9.1. Request

```
GET /api/enterprise/quotes/:quoteId/pdf
```

**Headers:**
- None required (public endpoint, but can be rate-limited)

**Path Parameters:**
- `quoteId` (string): The quote ID (e.g., `quote_1769585842554_5lkq2lvby`)

### 9.2. Response

**Success (200):**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="XS_Card_Quote_{quoteId}_{date}.pdf"`
- Body: PDF binary data

**Error (404):**
```json
{
  "success": false,
  "error": "Quote not found",
  "message": "The requested quote does not exist or has expired."
}
```

**Error (500):**
```json
{
  "success": false,
  "error": "PDF generation failed",
  "message": "Unable to generate PDF. Please try again later."
}
```

---

## 10. Frontend Integration

After backend implementation, the frontend will:

1. **Remove client-side PDF generation code** (jsPDF, html2canvas imports and `handleDownloadQuotePdf` function)
2. **Update download button** to call backend endpoint:

```typescript
const handleDownloadQuotePdf = async () => {
  if (!enterpriseQuote) return

  setIsGeneratingPdf(true)
  try {
    const response = await fetch(`${API_BASE_URL}/api/enterprise/quotes/${enterpriseQuote.quoteId}/pdf`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to download PDF')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `XS_Card_Quote_${enterpriseQuote.quoteId}_${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast({
      title: "Quote Downloaded",
      description: "Your quote has been downloaded successfully.",
      variant: "default",
    })
  } catch (error) {
    console.error('Error downloading PDF:', error)
    toast({
      title: "Download Failed",
      description: "Failed to download PDF. Please try again.",
      variant: "destructive",
    })
  } finally {
    setIsGeneratingPdf(false)
  }
}
```

---

## 11. Testing Checklist

To ensure the backend PDF matches the frontend version:

- [ ] Watermark appears correctly (rotated -45deg, opacity 0.08)
- [ ] All text matches exactly (fonts, sizes, colors)
- [ ] Spacing matches (margins, padding, gaps)
- [ ] Gradients render correctly (purple-to-blue, green-to-emerald)
- [ ] Rounded corners appear correctly
- [ ] QR code is 128x128px, centered, with border
- [ ] Payment URL link is clickable in PDF
- [ ] Date format is "DD Month YYYY" (e.g., "27 January 2025")
- [ ] Conditional logic works (estimate vs. exact pricing)
- [ ] Price range section only appears when `priceRange` exists
- [ ] Footer disclaimer only appears for range-based quotes
- [ ] Filename format matches: `XS_Card_Quote_{quoteId}_{date}.pdf`
- [ ] PDF page size is A4 width (210mm), height calculated from content

---

## 12. Assets & Fonts

- **No custom fonts** are used (default system fonts)
- **No logos** are embedded in the quote template
- **QR code** is generated dynamically from the payment entry URL

---

## 13. Notes

- The frontend uses **Tailwind CSS** classes, but the backend can use equivalent CSS or inline styles
- The watermark is purely visual and doesn't affect PDF functionality
- The clickable link overlay in the PDF should cover the payment URL text area (approximately 82% down the page)
- All prices are already formatted by the backend (`formattedPrice`, `formattedMinPrice`, `formattedMaxPrice`), so no additional formatting is needed

---

**End of Specification**
