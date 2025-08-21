# Mailgun Setup Guide - Complete Step-by-Step

## Why Mailgun?
- **5,000 emails/month FREE** (vs SendGrid's 100/day)
- **Excellent deliverability** rates
- **Reliable API** with good documentation
- **Easy integration** with fallback support

---

## Step 1: Create Mailgun Account

### 1.1 Sign Up
1. **Go to**: https://www.mailgun.com/
2. **Click "Sign Up Free"**
3. **Fill out the form**:
   - Email: `tshehlap@gmail.com` (or your preferred email)
   - Password: Create a strong password
   - Company: "XSpark" or your company name
4. **Click "Create Account"**

### 1.2 Verify Email
- Check your email inbox
- Click the verification link from Mailgun
- Complete any additional verification steps

### 1.3 Add Payment Method (Required for Free Tier)
- **Important**: Even for the free tier, Mailgun requires a credit card for verification
- Go to **Account Settings → Billing**
- Add your credit card (you won't be charged for the first 5,000 emails)

---

## Step 2: Domain Setup

### 2.1 Choose Domain Option

**Option A: Use Mailgun Sandbox (Quick Start)**
- Mailgun provides a sandbox domain immediately
- Format: `sandboxXXXXXXXX.mailgun.org`
- **Limitation**: Can only send to authorized recipients (you need to add email addresses)
- **Good for**: Testing and immediate setup

**Option B: Use Your Own Domain (Recommended for Production)**
- Use a subdomain like `mail.xspark.co.za`
- **Better for**: Production use, professional appearance
- **Requires**: DNS configuration

### 2.2 For Sandbox Domain (Quick Start)
1. **Go to**: Mailgun Dashboard → Sending → Domains
2. **Copy your sandbox domain** (looks like `sandboxXXXXXXXX.mailgun.org`)
3. **Add authorized recipients**:
   - Go to **Sending → Authorized Recipients**
   - Add `tshehlap@gmail.com` and any other emails you want to test with
   - Check email and click verification links

### 2.3 For Custom Domain (Production)
1. **Go to**: Mailgun Dashboard → Sending → Domains
2. **Click "Add New Domain"**
3. **Enter domain**: `mail.xspark.co.za` (or your preferred subdomain)
4. **Choose region**: US (unless you prefer EU)
5. **Add DNS records** to your domain provider:

```dns
# Add these DNS records to your domain:
TXT  mail.xspark.co.za  "v=spf1 include:mailgun.org ~all"
TXT  _domainkey.mail.xspark.co.za  "k=rsa; p=YOUR_PUBLIC_KEY_FROM_MAILGUN"
CNAME  email.mail.xspark.co.za  mailgun.org
MX   mail.xspark.co.za  mxa.mailgun.org (priority 10)
MX   mail.xspark.co.za  mxb.mailgun.org (priority 10)
```

---

## Step 3: Get API Credentials

### 3.1 Get API Key
1. **Go to**: Mailgun Dashboard → Settings → API Keys
2. **Copy "Private API Key"** (starts with `key-`)
3. **Keep this secure** - you'll need it for your app

### 3.2 Get Domain Name
- **Sandbox**: Copy from Domains page (e.g., `sandboxXXXXXXXX.mailgun.org`)
- **Custom**: Your domain (e.g., `mail.xspark.co.za`)

---

## Step 4: Test Your Setup

### 4.1 Test with cURL
```bash
curl -s --user 'api:YOUR_API_KEY_HERE' \
  https://api.mailgun.net/v3/YOUR_DOMAIN_HERE/messages \
  -F from='XSCard <test@YOUR_DOMAIN_HERE>' \
  -F to='tshehlap@gmail.com' \
  -F subject='Mailgun Test' \
  -F text='Testing Mailgun integration!'
```

### 4.2 Test with Node.js Script
```bash
cd backend
MAILGUN_API_KEY=your-key MAILGUN_DOMAIN=your-domain node test-mailgun.js
```

---

## Step 5: Environment Variables

Add these to your **local .env** file and **Render.com**:

```bash
# Mailgun Configuration
MAILGUN_API_KEY=key-your-actual-api-key-here
MAILGUN_DOMAIN=sandboxXXXXXXXX.mailgun.org  # or your custom domain
EMAIL_SERVICE=mailgun

# Keep your existing email settings as fallbacks
EMAIL_HOST=srv144.hostserv.co.za
EMAIL_USER=xscard@xspark.co.za
EMAIL_PASSWORD=your-password
EMAIL_FROM_NAME=XSCard
EMAIL_FROM_ADDRESS=xscard@xspark.co.za
```

---

## Step 6: Deploy to Production

### 6.1 Add to Render.com
1. **Go to**: Your Render.com service dashboard
2. **Navigate to**: Environment tab
3. **Add these variables**:
   ```
   MAILGUN_API_KEY=your-actual-key
   MAILGUN_DOMAIN=your-actual-domain
   EMAIL_SERVICE=mailgun
   NODE_ENV=production
   ```

### 6.2 Deploy Updated Code
1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add Mailgun email service integration"
   git push
   ```
2. **Render will auto-deploy** your updated code

---

## Step 7: Test in Production

### 7.1 Test Email Sending
- Try sending an email through your app
- Check Render.com logs for success messages
- Look for: `"Email sent via Mailgun to: ..."`

### 7.2 Monitor Usage
- **Mailgun Dashboard → Analytics** shows email statistics
- **Free tier**: 5,000 emails/month
- **Paid tiers**: Start at $35/month for 50,000 emails

---

## Troubleshooting

### Common Issues:

**401 Unauthorized**
- Check API key is correct
- Ensure you're using the right region (US vs EU)

**400 Bad Request**
- Verify domain is active in Mailgun dashboard
- Check DNS records if using custom domain
- Ensure "from" email uses your verified domain

**402 Payment Required**
- Add credit card to your Mailgun account
- Verify your account status

**Sandbox Limitations**
- Can only send to authorized recipients
- Add recipient emails in Mailgun dashboard

---

## Quick Start Commands

```bash
# 1. Test locally
cd backend
MAILGUN_API_KEY=your-key MAILGUN_DOMAIN=your-domain node test-mailgun.js

# 2. Test with cURL
curl -s --user 'api:YOUR_KEY' \
  https://api.mailgun.net/v3/YOUR_DOMAIN/messages \
  -F from='XSCard <test@YOUR_DOMAIN>' \
  -F to='your-email@gmail.com' \
  -F subject='Test' \
  -F text='Hello from Mailgun!'

# 3. Deploy to Render
git add . && git commit -m "Add Mailgun" && git push
```

---

## Next Steps After Setup

1. **Monitor email delivery** in Mailgun dashboard
2. **Set up webhooks** for bounce/complaint handling (optional)
3. **Configure custom domain** for better deliverability
4. **Add email templates** for consistent branding

Your email service now has **triple redundancy**: Mailgun → SendGrid → SMTP fallbacks!