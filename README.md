# Servd - Your AI-Powered Kitchen Assistant

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Strapi](https://img.shields.io/badge/Strapi-5.34-4945FF?style=for-the-badge&logo=strapi)](https://strapi.io/)
[![Clerk](https://img.shields.io/badge/Clerk-6.37-6C47FF?style=for-the-badge&logo=clerk)](https://clerk.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payments-3399CC?style=for-the-badge&logo=razorpay)](https://razorpay.com/)
[![Groq](https://img.shields.io/badge/Groq-AI-5B21B6?style=for-the-badge&logo=groq)](https://groq.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

**Turn your leftovers into masterpieces**

![Servd App Screenshot](frontend/screenshot/app.png)

[Features](#-features) • [Tech Stack](#-technology-stack) • [Getting Started](#-getting-started) • [Architecture](#-architecture) • [Contributing](#-contributing)

</div>

---

## What is Servd?

**Servd** is a modern, AI-powered web application that transforms how you cook meals at home. Simply snap a photo of your fridge or pantry, and our intelligent AI chef will:

- 🔍 **Identify ingredients** using Groq Vision AI
- 🍳 **Generate personalized recipes** based on what you have
- 📚 **Suggest recipes from a database** of thousands of dishes
- 💰 **Save money** by reducing food waste
- 📖 **Build your digital cookbook** by saving favorite recipes
- 🔐 **Offer premium features** through secure subscriptions

**The Problem:** According to the USDA, approximately 30-40% of the food supply in the United States goes to waste. One of the main contributors is food spoilage due to poor meal planning and not utilizing ingredients effectively.

**The Solution:** Servd helps you see your pantry through fresh eyes, suggesting delicious recipes that maximize the ingredients you already have.

---

## Key Features

### Smart Pantry Management
- **Photo-Based Scanning**: Upload an image of your fridge/pantry and AI automatically identifies ingredients
- **Manual Entry**: Add items by typing name and quantity
- **Organization**: Keep track of expiration dates and quantities
- **Real-time Sync**: All data stored securely in the cloud

### AI-Powered Recipe Generation
- **Instant Recipes**: Enter any dish name and get a complete, detailed recipe
- **Personalized Cooking**: AI considers your skill level and available ingredients
- **Dietary Filters**: Customize based on cuisine preferences, cooking time, and dietary needs
- **Smart Substitutions**: Automatically suggests ingredient alternatives

### Recipe Discovery & Management
- **Browse by Category**: Breakfast, Lunch, Dinner, Snacks, Desserts
- **Explore World Cuisines**: Italian, Chinese, Mexican, Indian, Thai, and more
- **Recipe of the Day**: Fresh inspiration delivered daily
- **Save & Organize**: Build your personal cookbook with saved favorites
- **Export to PDF**: Print or share recipes with family

### Secure User Accounts
- **Clerk Authentication**: Seamless sign-up/sign-in with email, Google, or social accounts
- **User Profiles**: Manage your preferences and subscription
- **Protected Routes**: Premium features secured behind authentication

### Subscription & Payments
- **Razorpay Integration**: Secure payment processing for subscriptions
- **Tiered Access**: Free tier with limits, Pro tier for unlimited access
- **Subscription Management**: View, upgrade, or cancel subscriptions
- **Secure Callbacks**: HMAC signature verification for payment security

### Security & Performance
- **Arcjet Protection**: Rate limiting and bot detection
- **Timing-Safe Comparisons**: Secure signature verification
- **Edge Caching**: Optimized for fast loading times

---

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework for production-grade applications |
| **React 19** | UI library for building interactive interfaces |
| **Tailwind CSS 4** | Utility-first CSS framework for styling |
| **Clerk** | Authentication and user management |
| **Lucide React** | Beautiful, consistent icon library |
| **Radix UI** | Accessible UI component primitives |
| **SWR** | React hook library for data fetching |
| **Sonner** | Beautiful, accessible toast notifications |

### Backend
| Technology | Purpose |
|------------|---------|
| **Strapi 5** | Headless CMS and API backend |
| **PostgreSQL** | Primary database (configurable) |
| **PostgreSQL** | Relational database for structured data |

### AI & External Services
| Service | Purpose |
|---------|---------|
| **Groq** | AI-powered recipe generation and image recognition |
| **TheMealDB** | External recipe database for browsing |
| **Unsplash** | High-quality recipe images |

### Payments & Security
| Service | Purpose |
|---------|---------|
| **Razorpay** | Payment gateway for subscriptions |
| **Arcjet** | Rate limiting, bot protection, and WAF |

---

## 📁 Project Structure

```
SERVD/
├── frontend/                 # Next.js frontend application
│   ├── app/                  # App Router pages and API routes
│   │   ├── (auth)/          # Authentication pages (sign-in, sign-up)
│   │   ├── (main)/          # Main application pages
│   │   │   ├── dashboard/   # Home dashboard
│   │   │   ├── recipes/     # Recipe discovery & saved recipes
│   │   │   ├── pantry/      # Pantry management
│   │   │   └── recipe/      # Individual recipe view
│   │   ├── api/             # API routes
│   │   │   ├── subscription/ # Razorpay subscription handling
│   │   │   └── webhooks/    # Webhook handlers
│   │   └── subscription/    # Subscription management pages
│   ├── components/           # Reusable React components
│   │   ├── ui/              # Base UI components
│   │   ├── Header.jsx       # Navigation header
│   │   ├── RecipeCard.jsx   # Recipe display cards
│   │   ├── PricingModal.jsx # Subscription pricing modal
│   │   ├── HowToCookModal.jsx # AI recipe search modal
│   │   └── ...
│   ├── actions/             # Server actions for data mutations
│   │   ├── mealdb.actions.js # MealDB API integration
│   │   ├── recipe.actions.js # Recipe CRUD operations
│   │   └── pantry.actions.js # Pantry item management
│   ├── lib/                 # Utility functions and configurations
│   │   ├── arcjet.js        # Rate limiting rules
│   │   ├── checkUser.js     # User authentication helper
│   │   └── data.js          # Static data (emojis, flags, etc.)
│   └── hooks/               # Custom React hooks
│
├── backend/                  # Strapi backend application
│   ├── src/
│   │   ├── api/             # Custom API endpoints
│   │   │   ├── recipe/      # Recipe content type
│   │   │   ├── pantry-item/ # Pantry item content type
│   │   │   └── saved-recipe/# Saved recipe relations
│   │   ├── extensions/      # Plugin extensions
│   │   └── index.js          # Backend entry point
│   ├── config/              # Configuration files
│   │   ├── database.js      # Database configuration
│   │   ├── server.js        # Server settings
│   │   └── plugins.js       # Plugin configuration
│   └── database/            # Database migrations
│
├── .env.example             # Environment variables template
└── README.md                # This file
```

---

## 🏗️ Architecture

![Architecture Diagram](frontend/screenshot/architecture.png)

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Next.js Frontend                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │ Landing  │  │ Dashboard│  │  Pantry  │  │ Recipes  │  │   │
│  │  │   Page   │  │          │  │  Manager │  │          │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│           Clerk Auth         │                                  │
│           (OAuth/Email)      │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  /api/subscription/create  │  Razorpay Payment Links      │  │
│  │  /api/subscription/callback│  Payment verification        │  │
│  │  /api/subscription/verify  │  Subscription activation     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│              Groq AI (Recipe Generation)               │
│              TheMealDB API (Recipe Discovery)                   │
│              Unsplash API (Recipe Images)                       │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Strapi Backend                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │  Users   │  │ Recipes  │  │ Pantry   │  │ Saved    │         │
│  │          │  │          │  │ Items    │  │ Recipes  │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                 │
│                        PostgreSQL DB                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow - Recipe Generation

```
User Input (Photo/Text)
        │
        ▼
┌─────────────────┐
│ Clerk Auth      │ ← Verify user identity & subscription tier
│ Authentication  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Arcjet Rate     │ ← Check usage limits (10 scans/month free)
│ Limit Check    │   (1000/day for Pro)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Groq Vision   │ ← AI vision for image recognition
│ Groq API      │   AI text for recipe generation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Groq API        │ ← Generate structured recipe JSON
│ Recipe Gen      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Strapi Backend  │ ← Save generated recipes
│ (PostgreSQL)    │   Link to user account
└────────┬────────┘
         │
         ▼
         │
    Display to User
```

### Subscription Flow

```
User Clicks "Upgrade"
        │
        ▼
┌─────────────────┐
│ Create Razorpay │ ← Generate Payment Link
│ Payment Link    │   Customer ID lookup/create
└────────┬────────┘
         │
         ▼
    User Completes Payment on Razorpay
        │
        ▼
┌─────────────────┐
│ Razorpay        │ ← POST callback with payment info
│ Callback        │   Signature verification (HMAC-SHA256)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify Payment  │ ← Fetch payment from Razorpay API
│ Status          │   Validate amount & customer
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update Strapi   │ ← Set subscriptionTier = "pro"
│ User Record     │   Store payment references
└────────┬────────┘
         │
         ▼
    Redirect to Success Page
```

---

## Installation

### Prerequisites

Before you begin, ensure you have installed:

- **Node.js** 20.x or higher (check with `node --version`)
- **npm** 6.x or higher (check with `npm --version`)
- **PostgreSQL** 14.x or higher (for production) OR
- **SQLite** (for development, included with Strapi)

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/aridepai17/SERVD.git
   cd SERVD
   ```

2. **Set up environment variables**
   
   Copy the example environment file and fill in your values:

   ```bash
   cp backend/.env.example backend/.env
   ```
   
   Required environment variables:
   
   ```env
   # Frontend (.env.local in frontend/ directory)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
   STRAPI_API_TOKEN=your-strapi-api-token
    GROQ_API_KEY=your-groq-api-key
   RAZORPAY_KEY_ID=your-razorpay-key-id
   RAZORPAY_KEY_SECRET=your-razorpay-key-secret
   RAZORPAY_PLAN_ID=your-razorpay-plan-id
   ARCJET_KEY=your-arcjet-key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-pub-key
   CLERK_SECRET_KEY=your-clerk-secret-key
   UNSPLASH_ACCESS_KEY=your-unsplash-access-key
   
   # Backend (backend/.env)
   HOST=0.0.0.0
   PORT=1337
   APP_KEYS=your-app-keys
   API_TOKEN_SALT=your-api-token-salt
   ADMIN_JWT_SECRET=your-admin-jwt-secret
   TRANSFER_TOKEN_SALT=your-transfer-token-salt
   JWT_SECRET=your-jwt-secret
   DATABASE_CLIENT=sqlite # or postgres for production
   DATABASE_FILENAME=.tmp/data.db # for SQLite
   # For PostgreSQL:
   # DATABASE_URL=postgresql://user:password@localhost:5432/servd
   ```

3. **Get API Keys**

   | Service | Sign Up At | Purpose |
   |---------|------------|---------|
   | **Clerk** | clerk.com | Authentication |
   | **Razorpay** | razorpay.com | Payment processing |
    | **Groq** | groq.com | AI recipe generation |
   | **Arcjet** | arcjet.com | Rate limiting & security |
   | **Unsplash** | unsplash.com/developers | Recipe images |

### Development Setup

1. **Start the backend (Strapi)**

   ```bash
   cd backend
   npm run develop
   ```
   
   This will:
   - Install dependencies
   - Create the database
   - Start the Strapi admin panel at http://localhost:1337/admin
   - Create your admin account when prompted

2. **Start the frontend (Next.js)**

   ```bash
   cd frontend
   npm run dev
   ```

   Access the app at http://localhost:3000

### Production Deployment

For production deployment:

1. **Use PostgreSQL** instead of SQLite

2. **Build the Strapi admin panel**

   ```bash
   cd backend
   npm run build
   npm run start
   ```

3. **Build the Next.js application**

   ```bash
   cd frontend
   npm run build
   npm start
   ```

---

## Usage Guide

### For Home Cooks

1. **Getting Started**

   - Visit https://servdai.vercel.app
   - Click "Start Cooking Free" to create an account
   - Browse recipes or scan your pantry

2. **Scanning Your Pantry**
   - Go to "My Pantry" page
   - Click "Add to Pantry"
   - Upload a photo of your fridge contents
   - AI identifies ingredients automatically
   - Save items to your pantry

3. **Finding Recipes**
   - Use the search bar to find any dish
   - Browse by category (Breakfast, Dinner, etc.)
   - Explore world cuisines
   - Check "Recipe of the Day" for inspiration

4. **Getting AI Recipe Suggestions**
   - Go to "My Pantry"
   - Click "What Can I Cook Today?"
   - AI suggests recipes matching your ingredients
   - Shows match percentage and missing items

5. **Upgrading to Pro**
   - Click the "Free Plan" badge in the header
   - Select "Head Chef Pro" plan
   - Complete secure payment via Razorpay
   - Enjoy unlimited pantry scans and AI recipes

### For Developers

#### Adding a New Feature

1. **Create a new API route**

   ```javascript
   // frontend/app/api/your-feature/route.js
   import { NextResponse } from "next/server";
   
   export async function GET(request) {
     // Your logic here
     return NextResponse.json({ data: "..." });
   }
   ```

2. **Create a server action**

   ```javascript
   // frontend/actions/your-action.js
   "use server";
   
   export async function yourAction(formData) {
     // Your logic here
     return { success: true, data: "..." };
   }
   ```

3. **Add a Strapi content type**

   ```bash
   cd backend
   npm run strapi generate content-type
   ```

#### Modifying the UI

The project uses Tailwind CSS. Key design tokens:

- Primary color: Orange-600 (#ea580c)
- Background: Stone-50 (#fafaf9)
- Text: Stone-900 (#1c1917)

---

## Security Features

### Authentication & Authorization

- **Clerk Integration**: Secure OAuth2 authentication
- **Server-Side Verification**: All API routes verify user identity
- **Role-Based Access**: Protected routes based on subscription tier

### Payment Security

- **HMAC Signature Verification**: All Razorpay callbacks verified
- **Timing-Safe Comparison**: Prevents timing attacks
- **Customer ID Validation**: Ensure payments belong to correct user
- **Environment Secrets**: All keys stored securely in environment variables

### Rate Limiting & Abuse Prevention

- **Arcjet Integration**: Token bucket rate limiting
- **Free Tier**: 10 pantry scans/month, 5 AI recipes/month
- **Pro Tier**: 1000 requests/day
- **Bot Detection**: WAF protection against malicious requests

### Data Protection

- **API Tokens**: Strapi tokens never exposed to client
- **Input Validation**: All user inputs validated server-side
- **SQL Injection Prevention**: Parameterized queries via Strapi ORM

---

## API Reference

### Frontend API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/subscription/create` | POST | Create Razorpay Payment Link |
| `/api/subscription/callback` | POST/GET | Handle Razorpay payment callback |
| `/api/subscription/verify` | POST | Verify and activate subscription |
| `/api/webhooks/razorpay` | POST | Handle Razorpay webhook events |

### Strapi API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/recipes` | GET, POST | Recipe CRUD operations |
| `/api/pantry-items` | GET, POST, PUT, DELETE | Pantry management |
| `/api/saved-recipes` | GET, POST, DELETE | User's saved recipes |
| `/api/users` | GET, PUT, POST | User profile management |

### Server Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `getOrGenerateRecipe(formData)` | recipeName | Get existing or generate new recipe |
| `saveRecipeToCollection(formData)` | recipeId | Save recipe to favorites |
| `getPantryItems()` | - | Fetch user's pantry items |
| `scanPantryImage(formData)` | image file | AI ingredient recognition |
| `saveToPantry(formData)` | ingredients array | Save scanned items |
| `addPantryItemManually(formData)` | name, quantity | Add single item |

---

## Testing

Currently, manual testing is performed:

1. **Unit Testing**: Jest configuration available
2. **Integration Testing**: Manual API testing with Postman/curl
3. **E2E Testing**: Playwright can be configured

To add automated tests:

```bash
# Install testing dependencies
npm install -D jest @testing-library/react @testing-library/user-event

# Run tests
npm test
```

---

## Deployment Options

### Vercel (Frontend)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Strapi Cloud

[![Deploy to Strapi Cloud](https://market-assets.strapi.io/assets/deploy-to-strapi-cloud.png)](https://cloud.strapi.io)

1. Connect your GitHub repository
2. Configure environment variables
3. Deploy with one click

### Docker

```bash
# Build and run with Docker Compose
docker-compose up -d
```

---

## Roadmap

### Version 2.0 (Planned)

- [ ] **Shopping List**: Auto-generate shopping lists from recipes
- [ ] **Meal Planning**: Weekly meal planning calendar
- [ ] **Social Features**: Share recipes with friends, follow cooks
- [ ] **Voice Commands**: Cook hands-free with voice assistant
- [ ] **Mobile App**: Native iOS and Android apps
- [ ] **Nutritional Tracking**: Calorie and macro tracking
- [ ] **Dietary Restrictions**: Keto, Paleo, Vegetarian, Vegan filters
- [ ] **Video Recipes**: Embedded cooking videos
- [ ] **Kitchen Timer**: Built-in timers for each step
- [ ] **Multi-Lingual**: Support for multiple languages

### Version 3.0 (Vision)

- [ ] **AR Integration**: Point camera at ingredients for suggestions
- [ ] **Smart Appliances**: Connect with smart ovens, refrigerators
- [ ] **Grocery Delivery**: One-click ordering of missing ingredients
- [ ] **Chef Chatbot**: Conversational AI for cooking advice
- [ ] **Recipe Scanner**: Scan physical cookbook recipes
- [ ] **Food Expiry Prediction**: AI prediction of food freshness
- [ ] **Cost Analysis**: Recipe cost calculator
- [ ] **Carbon Footprint**: Environmental impact of meals

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Ways to Contribute

- 🐛 **Report bugs** by opening an issue
- 💡 **Suggest features** by opening a feature request
- 📝 **Improve documentation** by submitting a PR
- 🔧 **Fix bugs** by submitting a PR
- 🎨 **Improve UI/UX** by submitting design suggestions
- 🌍 **Translate** the app into your language

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **TheMealDB** for providing an amazing free recipe API
- **Unsplash** for beautiful, free-to-use photography
- **Groq** for AI recipe generation
- **Open Source Community** for the incredible tools we build upon
- **Our Contributors** who make Servd better every day

---

## Support

- 🐛 **Issues**: [Report bugs on GitHub](https://github.com/aridepai17/SERVD/issues)

---

<div align="center">

**Made with ❤️ for home cooks everywhere**

[Website](https://servdai/vercel/app) • [GitHub](https://github.com/aridepai17/SERVD)

</div>