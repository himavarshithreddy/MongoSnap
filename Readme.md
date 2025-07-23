# MongoSnap

<p align="center">
  <img src="https://mongosnap.live/MongoSnap.svg" alt="MongoSnap Logo" width="120" />
</p>

<p align="center">
  <b>Web-based MongoDB query generation and management tool.</b>
</p>

<p align="center">
  <a href="https://mongosnap.live">Live Site</a> •
  <a href="#user-guide">User Guide</a> •
  <a href="#technical-overview">Technical Overview</a>
</p>

---

## Overview

MongoSnap is a web application for generating, running, and managing MongoDB queries. It provides AI-assisted query generation, a visual interface for data exploration, and secure user authentication. The platform is hosted on AWS and uses MongoDB Atlas for data storage.

---

## User Guide

### Main Features

| Feature                  | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| AI Query Generation     | Generate MongoDB queries from plain English using integrated AI.             |
| Visual Query Builder    | Build, edit, and run queries with a code editor and visual tools.            |
| Schema Explorer         | Browse and understand your database structure.                               |
| Query History           | Access and repeat your past queries.                                         |
| Saved Queries           | Bookmark and organize frequently used queries.                               |
| Data Export             | Export query results.                                                        |
| Two-Factor Auth (2FA)   | Add an extra layer of security to your account.                              |
| In-app Support          | Report bugs or contact support from within the app.                          |
| SnapX Premium           | Remove query limits and access additional features.                          |

### Getting Started

1. Go to [mongosnap.live](https://mongosnap.live)
2. Sign up for an account.
3. Connect your MongoDB database.
4. Use natural language or the visual builder to generate and run queries.
5. Upgrade to SnapX for higher limits and more features.

### Payments & Support
- Payments are processed via PayU. SnapX is activated after payment.
- For support, email [support@mongosnap.live](mailto:support@mongosnap.live) or use the in-app forms.

---

## Technical Overview

### Architecture

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React, Vite, Tailwind CSS         |
| Backend    | Node.js, Express, Mongoose        |
| Database   | MongoDB Atlas                     |
| Payments   | PayU                             |
| Email      | Nodemailer + Brevo (SMTP)         |
| Hosting    | AWS                               |
| Security   | JWT, CSRF, 2FA, HTTPS, Rate Limit |

### AI Query Generation
- Users can enter requests in plain English (e.g., "Show all orders from last month").
- The frontend sends this prompt to the backend, which uses an AI model to generate a MongoDB query.
- The query is returned to the frontend, where it can be reviewed, edited, and executed.

### Security & Compliance
- All data in transit is encrypted (HTTPS).
- JWT authentication, CSRF protection, and 2FA are available.
- Rate limiting and CORS are enabled.
- Database credentials are not stored after session ends.
- Privacy Policy, Terms of Service, and Refund Policy are available in-app.

### Project Structure
```
MongoSnap/
  apps/
    backend/         # Express API, models, routes, utils
    frontend/        # React app, components, pages, assets
  package.json       # Monorepo root
  pnpm-workspace.yaml
  README.md
```

### Key Modules
- **Backend:** Models (User, PaymentTransaction), routes (auth, payment, query), utilities (mailer, PayU integration)
- **Frontend:** Components (QueryInterface, Payment, SchemaExplorer), pages (Home, Login, Pricing, PaymentSuccess), context (UserContext), hooks, and assets

### Payment & Email Systems
- Payments are processed via PayU, with backend verification and SnapX activation.
- Transactional emails (verification, reset, 2FA, login alert) are sent via Brevo SMTP.

### Deployment
- Hosted on AWS
- Database on MongoDB Atlas

### License
MIT License

---

<p align="center"><b>MongoSnap — MongoDB query generation and management in your browser.</b></p>
