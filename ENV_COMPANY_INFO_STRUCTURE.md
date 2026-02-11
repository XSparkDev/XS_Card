# Company Information Environment Variables

**Purpose:** Store XSCard company information for invoice/receipt generation  
**Location:** `.env` file in backend directory  
**Helper:** `backend/utils/companyInfo.js`

---

## Required Environment Variables

Add these to your `.env` file:

```bash
# Company Name
COMPANY_NAME="XSCard"

# Company Address
COMPANY_STREET="Your Street Address"
COMPANY_CITY="Your City"
COMPANY_PROVINCE="Your Province/State"  # Optional
COMPANY_POSTAL_CODE="Your Postal Code"
COMPANY_COUNTRY="Your Country"

# Company Contact
COMPANY_PHONE="+1 123-456-7890"  # Format: +[country code][number]
COMPANY_EMAIL="hi@xscard.com"

# Company Tax/VAT (Optional)
COMPANY_VAT_NUMBER="ZA VAT 1234567890"  # Or "US EIN 12-3456789" format
```

---

## Example Values

Based on Cursor receipt structure:

```bash
COMPANY_NAME="XSCard"
COMPANY_STREET="801 West End Avenue"
COMPANY_CITY="New York"
COMPANY_PROVINCE="New York"
COMPANY_POSTAL_CODE="10025"
COMPANY_COUNTRY="United States"
COMPANY_PHONE="+1 831-425-9504"
COMPANY_EMAIL="hi@xscard.com"
COMPANY_VAT_NUMBER="US EIN 87-4436547"  # Replace with your actual VAT/EIN
```

---

## Usage

The helper function `getCompanyInfo()` will fetch these values:

```javascript
const { getCompanyInfo } = require('./utils/companyInfo');

// In invoice generation
const companyInfo = getCompanyInfo();
// Returns:
// {
//   name: "XSCard",
//   address: {
//     street: "801 West End Avenue",
//     city: "New York",
//     province: "New York",
//     postalCode: "10025",
//     country: "United States"
//   },
//   phone: "+1 831-425-9504",
//   email: "hi@xscard.com",
//   vatNumber: "US EIN 87-4436547"
// }
```

---

## Notes

- **COMPANY_PROVINCE** is optional - leave empty if not applicable
- **COMPANY_VAT_NUMBER** is optional - leave empty if you don't have one
- All other fields are **required** - the helper will throw an error if missing
- Phone number format should include country code (e.g., `+1` for US, `+27` for South Africa)

---

**Last Updated:** 2025-01-27
