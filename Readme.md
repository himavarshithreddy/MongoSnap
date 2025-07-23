# MongoSnap

<p align="center">
  <img src="https://mongosnap.live/MongoSnap.png" alt="MongoSnap Logo" width="120" />
</p>

<p align="center">
  <b>Effortless, AI-powered MongoDB management for teams and professionals.</b>
</p>

<p align="center">
  <a href="https://mongosnap.live">🌐 Live Site</a> •
  <a href="#user-guide">User Guide</a> •
  <a href="#technical-overview">Technical Overview</a>
</p>

---

## 🚀 At a Glance

MongoSnap transforms the way you work with MongoDB:
- **AI Query Generation:** Instantly convert natural language into complex MongoDB queries.
- **Visual Data Exploration:** Browse, filter, and manage your data with a modern, intuitive UI.
- **Enterprise Security:** Built-in 2FA, encrypted connections, and robust access controls.
- **Seamless Payments:** Upgrade to SnapX for unlimited access and premium features.
- **Cloud Native:** Hosted on AWS, with managed storage on MongoDB Atlas.

---

## 🧑‍💼 User Guide

### Key Capabilities

| Capability                | Description                                                                 |
|--------------------------|-----------------------------------------------------------------------------|
| **AI Query Generation**  | Generate MongoDB queries from plain English using integrated AI.             |
| **Visual Query Builder** | Build, edit, and run queries with a code editor and visual tools.            |
| **Schema Explorer**      | Instantly browse and understand your database structure.                     |
| **Query History**        | Access, repeat, and manage all your past queries.                            |
| **Saved Queries**        | Bookmark and organize your most-used queries.                                |
| **Data Export**          | Export query results for reporting or analysis.                              |
| **2FA & Security**       | Protect your account with two-factor authentication and secure sessions.     |
| **Admin Dashboard**      | Manage bug reports and user contact submissions.                             |
| **In-app Support**       | Report bugs or contact support directly from the interface.                  |
| **SnapX Premium**        | Unlock unlimited queries, advanced features, and priority support.           |

### Getting Started

1. **Visit:** [mongosnap.live](https://mongosnap.live)
2. **Sign Up:** Create your secure account.
3. **Connect:** Add your MongoDB URI and credentials.
4. **Generate & Run:** Use natural language or the visual builder to create and execute queries.
5. **Upgrade:** Go premium with SnapX for full power and support.

### Payments & Support
- **Payments:** Securely processed via PayU. SnapX activates instantly after payment.
- **Support:** Email [support@mongosnap.live](mailto:support@mongosnap.live) or use in-app forms.

---

## 🏢 Technical Overview

### Architecture Summary

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | React, Vite, Tailwind CSS         |
| Backend    | Node.js, Express, Mongoose        |
| Database   | MongoDB Atlas (cloud-hosted)      |
| Payments   | PayU (India)                      |
| Email      | Nodemailer + Brevo (SMTP)         |
| Hosting    | AWS                               |
| Security   | JWT, CSRF, 2FA, HTTPS, Rate Limit |

### AI Query Generation
> **How it works:**
> - Users enter requests in plain English (e.g., "Show all orders from last month").
> - The frontend sends this prompt to the backend, which uses an AI model to generate a valid MongoDB query.
> - The query is returned, editable, and executable in the UI.
> - This empowers all users—regardless of technical skill—to work with MongoDB efficiently and accurately.

### Security & Compliance
- All data in transit is encrypted (HTTPS).
- JWT authentication, CSRF protection, and 2FA are enforced.
- Rate limiting and CORS are active on all endpoints.
- No database credentials are stored after session ends.
- Privacy Policy, Terms of Service, and Refund Policy are accessible in-app.

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

### Key Backend & Frontend Modules
- **Backend:** Models (User, PaymentTransaction), routes (auth, payment, query), utilities (mailer, PayU integration)
- **Frontend:** Components (QueryInterface, Payment, SchemaExplorer), pages (Home, Login, Pricing, PaymentSuccess), context (UserContext), hooks, and assets

### Payment & Email Systems
- **Payments:** All transactions are securely processed via PayU, with backend verification and instant SnapX activation.
- **Emails:** All transactional emails (verification, reset, 2FA, login alert) are sent via Brevo SMTP, using a modern, branded template.

### Deployment
- **Hosting:** AWS (high availability, scalability)
- **Database:** MongoDB Atlas (managed, secure, scalable)

### License
MIT License

---

<p align="center"><b>MongoSnap — The new standard for MongoDB productivity.</b></p>
