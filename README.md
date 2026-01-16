# SXRX Shopify Theme

A customized Shopify theme for the SXRX healthcare telemedicine platform, based on the Vision theme by Fuel Themes. This theme integrates with RevenueHunt questionnaires, Cowlendar appointment booking, Tebra EHR, and a custom backend API.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Theme Structure](#theme-structure)
- [Custom Integrations](#custom-integrations)
- [Installation](#installation)
- [Configuration](#configuration)
- [Custom Pages](#custom-pages)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

## 🎯 Overview

This theme extends the Vision theme (v11.0.0) by Fuel Themes with custom functionality for:
- **Questionnaire Integration**: RevenueHunt v2 quiz integration for product requirements
- **Appointment Booking**: Cowlendar integration for scheduling consultations
- **Patient Portal**: Custom pages for patient chart and appointment management
- **Product Categorization**: Advanced product tagging and metafield support
- **Subscription Management**: Support for subscription and one-time purchase options

## ✨ Features

### Core Theme Features
- Modern, responsive design based on Vision theme
- Multiple theme variants (Emerald, Poochy, Velocite, Winter)
- Multi-language support (English, German, Spanish, French, Italian, Dutch, Turkish)
- Product comparison functionality
- Quick view product modals
- Advanced search and filtering
- Recently viewed products
- Cart notes and discounts
- Pickup availability
- Customer account management

### Custom Healthcare Features
- **Questionnaire Flow**: Products can require questionnaires before purchase
- **Quiz Integration**: RevenueHunt v2 quiz embedding and submission
- **Appointment Scheduling**: Cowlendar booking widget integration
- **Patient Chart**: Custom page for viewing patient information and medical records
- **Appointment Management**: View and manage appointments from the storefront
- **Purchase Type Selection**: Choose between subscription or one-time purchase
- **State-based Routing**: Provider routing based on customer location

## 📁 Theme Structure

```
shopify_new/
├── assets/              # CSS, JavaScript, and image files
│   ├── *.css           # Stylesheets (81 files)
│   ├── *.js            # JavaScript files (57 files)
│   └── *.png           # Image assets
├── config/             # Theme configuration
│   ├── settings_data.json      # Current theme settings
│   └── settings_schema.json    # Theme customization options
├── layout/             # Base layout templates
│   ├── password.liquid # Password page layout
│   └── theme.liquid    # Main theme layout
├── locales/            # Translation files
│   ├── en.default.json # English (default)
│   ├── de.json         # German
│   ├── es.json         # Spanish
│   ├── fr.json         # French
│   ├── it.json         # Italian
│   ├── nl.json         # Dutch
│   └── tr.json         # Turkish
├── sections/           # Reusable section templates (91 files)
├── snippets/          # Reusable code snippets (77 files)
└── templates/         # Page templates
    ├── customers/     # Customer account templates
    ├── page.*.json    # Custom page templates
    └── product.*.json # Product page variants
```

## 🔌 Custom Integrations

### Key Custom JavaScript Files

#### `questionnaire-integration.js`
- Handles RevenueHunt quiz embedding
- Manages quiz completion flow
- Controls add-to-cart button visibility
- Handles purchase type selection (Subscription/One-time)

#### `my-chart.js`
- Displays patient information from backend API
- Shows medical records and documents
- Integrates with Tebra EHR system

#### `my-appointments.js`
- Displays customer appointments
- Integrates with Cowlendar booking system
- Shows appointment details and status

#### `schedule-integration.js`
- Cowlendar booking widget integration
- Appointment scheduling functionality
- Provider availability display

### Key Custom Templates

#### `templates/page.questionnaire.liquid`
- Questionnaire page template
- Embeds RevenueHunt quiz
- Handles quiz completion and submission

#### `templates/page.my-chart.json`
- Patient chart page
- Displays patient information and medical records
- Requires customer authentication

#### `templates/page.my-appointments.json`
- Appointment management page
- Lists customer appointments
- Shows appointment details and status

### Key Custom Snippets

#### `snippets/quiz-id-mapping.liquid`
- Maps product tags to RevenueHunt quiz IDs
- Configures which quiz to show for each product category

#### `snippets/product-add-to-cart.liquid`
- Custom add-to-cart functionality
- Handles questionnaire requirements
- Manages purchase type selection

## 🚀 Installation

### Prerequisites
- Shopify store with admin access
- Shopify CLI (optional, for development)
- Backend API deployed and configured
- RevenueHunt account with quiz IDs
- Cowlendar booking app installed

### Method 1: Shopify CLI (Recommended for Development)

```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Navigate to theme directory
cd shopify_new

# Login to Shopify
shopify theme login --store your-store.myshopify.com

# Upload as new unpublished theme
shopify theme push --unpublished --theme "SXRX Theme"

# Or start development server
shopify theme dev
```

### Method 2: Manual Upload via Admin

1. Create a ZIP file of the `shopify_new` folder contents
   - **Important**: Zip the contents, not the folder itself
   - Should include: `assets/`, `config/`, `layout/`, `sections/`, `snippets/`, `templates/`, `locales/`

2. Go to Shopify Admin → Online Store → Themes

3. Click "Add theme" → "Upload zip file"

4. Select your ZIP file and upload

5. Rename the theme to "SXRX Theme" or your preferred name

For detailed instructions, see [`02_THEME_UPLOAD_GUIDE.md`](../02_THEME_UPLOAD_GUIDE.md)

## ⚙️ Configuration

### 1. Backend API Configuration

Update the backend API URL in the theme files:

**Files to update:**
- `assets/questionnaire-integration.js` - API endpoints
- `assets/my-chart.js` - API endpoints
- `assets/my-appointments.js` - API endpoints
- `assets/schedule-integration.js` - API endpoints

**Search for:**
```javascript
const API_BASE_URL = 'https://your-backend-api.com';
```

### 2. RevenueHunt Quiz IDs

Update quiz ID mappings in:
- `snippets/quiz-id-mapping.liquid`

**Quiz categories:**
- Erectile Dysfunction
- General Health
- Hair Loss
- Low Libido
- Low Testosterone
- Menopause HRT
- Mental Health
- Premature Ejaculation
- Weight Management

### 3. Product Configuration

Products requiring questionnaires should have:
- Tag: `requires-questionnaire`
- Category tag: `quiz-erectile-dysfunction`, `quiz-hair-loss`, etc.
- Metafields for subscription configuration (if applicable)

See [`07_PRODUCT_CONFIGURATION_GUIDE.md`](../07_PRODUCT_CONFIGURATION_GUIDE.md) for details.

### 4. Required Pages

Create the following pages in Shopify Admin:
- `/pages/questionnaire` - Questionnaire page
- `/pages/my-chart` - Patient chart page
- `/pages/my-appointments` - Appointments page

See [`04_SHOPIFY_MANUAL_SETTINGS_GUIDE.md`](../04_SHOPIFY_MANUAL_SETTINGS_GUIDE.md) for page setup.

### 5. Webhook Configuration

Configure webhooks in Shopify Admin:
- RevenueHunt webhook: `POST /webhooks/revenue-hunt` (handled by frontend JavaScript)
- Shopify Order Created: `POST /webhooks/shopify/orders/created` (for Cowlendar bookings)
- Shopify Order Paid: `POST /webhooks/shopify/orders/paid` (for order processing)

See [`05_REVENUEHUNT_WEBHOOK_SETUP.md`](../05_REVENUEHUNT_WEBHOOK_SETUP.md) for details.

## 📄 Custom Pages

### Questionnaire Page (`/pages/questionnaire`)

**Template:** `page.questionnaire.liquid`

**Features:**
- Embeds RevenueHunt quiz based on product category
- Handles quiz completion
- Shows purchase type selector (Subscription/One-time)
- If no red flags: Automatically adds to cart and redirects to checkout
- If red flags: Shows consultation scheduling → redirects to `/products/appointment-booking`

**URL Parameters:**
- `product_id` - Shopify product ID
- `variant_id` - Product variant ID
- `quiz_type` - Quiz category (optional, auto-detected from product tags)

### Patient Chart Page (`/pages/my-chart`)

**Template:** `page.my-chart.json`

**Features:**
- Displays patient information from Tebra EHR
- Shows medical records and documents
- Requires customer authentication
- Integrates with backend API

**Access:**
- Customer must be logged in
- Customer must be linked to Tebra patient record

### Appointments Page (`/pages/my-appointments`)

**Template:** `page.my-appointments.json`

**Features:**
- Lists customer appointments
- Shows appointment details (date, time, provider, status)
- Integrates with Cowlendar and Tebra
- Displays Google Meet links for telemedicine appointments

## 🛠️ Development

### Local Development Setup

```bash
# Install Shopify CLI
npm install -g @shopify/cli @shopify/theme

# Navigate to theme directory
cd shopify_new

# Start development server
shopify theme dev

# This will:
# - Create a development theme
# - Start local server
# - Sync changes in real-time
# - Provide preview URL
```

### File Structure Guidelines

- **Sections** (`sections/`): Reusable page sections
- **Snippets** (`snippets/`): Reusable code components
- **Templates** (`templates/`): Page templates
- **Assets** (`assets/`): CSS, JavaScript, images
- **Layout** (`layout/`): Base layouts

### Testing Checklist

Before publishing:
- [ ] Test questionnaire flow with products
- [ ] Verify RevenueHunt quiz embedding
- [ ] Test no red flags flow: Automatically adds to cart and redirects to checkout
- [ ] Test red flags flow: Shows consultation scheduling → redirects to `/products/appointment-booking`
- [ ] Verify purchase type selection (subscription vs one-time)
- [ ] Test patient chart page (requires logged-in customer)
- [ ] Test appointments page
- [ ] Verify Cowlendar booking integration (appointment product shows "Book Now" button)
- [ ] Test on mobile devices
- [ ] Check all theme variants
- [ ] Verify webhook endpoints (`/webhooks/revenue-hunt`, `/webhooks/shopify/orders/created`)

## 🐛 Troubleshooting

### Questionnaire Not Showing

**Symptoms:** Quiz doesn't appear on questionnaire page

**Solutions:**
1. Check product has `requires-questionnaire` tag
2. Verify quiz ID in `snippets/quiz-id-mapping.liquid`
3. Check browser console for JavaScript errors
4. Verify RevenueHunt quiz ID is correct
5. Check API endpoint is accessible

### Not Redirecting to Checkout After Questionnaire

**Symptoms:** After completing questionnaire with no red flags, customer is not redirected to checkout

**Solutions:**
1. Check backend API response includes `action: "proceed_to_checkout"`
2. Verify backend API is receiving webhook data at `/webhooks/revenue-hunt`
3. Check browser console for JavaScript errors
4. Verify product variant ID is available (needed to add to cart)
5. Check that `/cart/add.js` endpoint is accessible
6. Verify customer is not blocked by browser popup blockers

### Patient Chart Not Loading

**Symptoms:** Chart page shows error or is empty

**Solutions:**
1. Verify customer is logged in
2. Check customer is linked to Tebra patient record
3. Verify backend API endpoint is correct
4. Check API authentication tokens
5. Verify Tebra integration is configured

### Appointments Not Showing

**Symptoms:** Appointments page is empty

**Solutions:**
1. Verify customer is logged in
2. Check Cowlendar integration is configured
3. Verify backend API is receiving appointment data
4. Check API endpoint configuration
5. Verify appointments exist in Cowlendar

## 📚 Additional Documentation

- [`00_READ_ME_FIRST.md`](../00_READ_ME_FIRST.md) - Start here for setup guide
- [`02_THEME_UPLOAD_GUIDE.md`](../02_THEME_UPLOAD_GUIDE.md) - Detailed upload instructions
- [`04_SHOPIFY_MANUAL_SETTINGS_GUIDE.md`](../04_SHOPIFY_MANUAL_SETTINGS_GUIDE.md) - Post-upload configuration
- [`07_PRODUCT_CONFIGURATION_GUIDE.md`](../07_PRODUCT_CONFIGURATION_GUIDE.md) - Product setup
- [`10_QUIZ_WORKFLOW_DIAGRAM.md`](../10_QUIZ_WORKFLOW_DIAGRAM.md) - Quiz workflow overview
- [`backend/README.md`](../backend/README.md) - Backend API documentation

## 🆘 Support

### Theme Support
- **Base Theme**: Vision by Fuel Themes
- **Documentation**: https://documentation.fuelthemes.net/article-categories/vision/
- **Support**: https://fuelthemes.net/contact/

### Custom Integrations Support
- Review project documentation in root directory
- Check backend API logs for integration issues
- Verify webhook configurations
- Review browser console for JavaScript errors

## 📝 Version Information

- **Theme Base**: Vision v11.0.0 by Fuel Themes
- **Custom Version**: SXRX Custom Build
- **Last Updated**: 2025
- **Shopify API Version**: Compatible with latest Shopify APIs

## 🔒 Security Notes

- All API calls should use HTTPS
- Customer authentication required for sensitive pages
- Webhook endpoints should be secured
- API tokens should be stored securely
- Never commit API keys or secrets to version control

## 📄 License

- **Base Theme**: Licensed by Fuel Themes
- **Custom Code**: Proprietary - SXRX Platform

---

**For setup instructions, start with [`00_READ_ME_FIRST.md`](../00_READ_ME_FIRST.md) in the project root.**
