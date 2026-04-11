
  

## 🛡️ Daemon Vault: Digital Evidence Management System (DEMS)
> A purpose-built, web-based Digital Evidence Management System engineered to address the forensic limitations of general-purpose consumer cloud storage.

**Developed By:** Kyle ([@Kyle8973](https://github.com/Kyle8973))

**Academic Context:** BSc (Hons) Cybersecurity & Digital Forensics (Computing Project / Dissertation)

---

## 📖 Overview

Daemon Vault is a zero-budget, forensically sound DEMS that guarantees non-repudiation, strict Role-Based Access Control (RBAC), and mathematical evidence integrity. It enforces the Association of Chief Police Officers (ACPO) digital forensic principles directly at the application layer, democratising secure evidence storage for resource-constrained investigative units.

### ⚡ Core Forensic Capabilities

*  **🔐 Cryptographic Ingestion:** Automated **SHA-256** hashing computed server-side immediately upon file ingestion.

*  **📦 Secure Envelope Encryption:** All digital evidence is encrypted at rest utilising **AES-GCM**. The master decryption key is isolated strictly in volatile memory.

*  **📜 Immutable Chain of Custody:** Append-only MongoDB collections (`caselogs`, `systemlogs`) ensure non-repudiation (ACPO 2012 Principle 3). No Delete/Update API routes are exposed.

*  **🛡️ Strict Access Control:** Role-Based Access Control (RBAC) enforced at both the API and UI level (Manager, Contributor, Viewer).

*  **📄 Legal Reporting:** Automated generation of court-admissible PDF Chain of Custody reports from aggregated audit logs.
---

## 🛠️ Technology Stack
*  **Runtime:** [Node.js](https://nodejs.org/)
*  **Database:** [MongoDB Community](https://www.mongodb.com/)
*  **Frontend:** Vanilla HTML5 / CSS3 / JavaScript
*  **Deployment:** Local Node.js server



---

## 🚀 Installation & Setup

### 1. Prerequisites
Daemon Vault is designed to run locally. Ensure you have the following installed on your host machine (Windows x86 preferred):

*  **Node.js** (v18.x or later)
*  **MongoDB Community** (v7.0 or later) running as a local service on port `27017`.

### 2. Obtain the Source Code

```bash
git  clone  https://github.com/Kyle8973/Daemon-Vault.git
cd  Daemon-Vault
```

### 3. Install Dependencies
```bash
npm  install
```

### 4. Environment Configuration

Locate the `.env.example` file in the project root and rename / copy it to `.env`. Configure the following variables:

  

```
# Server Configuration
PORT=3000

# Database Connection
MONGODB_URL=mongodb://localhost:27017/daemon_vault

# Session Security (Login System)
# Replace with a long random string of text
SESSION_SECRET=

# Allow User Registration (true / false)
DISABLE_REGISTRATION=false # Set To True To Disable

# Security: Login Rate Limiting
RATE_LIMIT_MAX_ATTEMPTS=5
RATE_LIMIT_WINDOW_MINUTES=5
RATE_LIMIT_BLOCK_MINUTES=1

# DB Log Configuration
ENABLE_DB_LOGS=true
# How long to keep logs in seconds?
# 3600 = 1 Hour
# 86400 = 1 Day
# 604800 = 1 Week
# 0 = Never Delete
LOG_RETENTION_SECONDS=172800 # 2 Days
```

----------

## 🔑 Running the Application

### The Master Unlock Key

To ensure absolute cryptographic sole-custody, Daemon Vault generates a dynamic **Master Unlock Key** on its first run.

1. Start the server:
```bash
npm  start
```

2.  **STOP AND READ THE CONSOLE:** The server will output a 32-character Master Unlock Key. **You have exactly 10 seconds to copy and securely store this key** before the console clears.

3.  _Warning: If this key is lost, you will permanently lose access to all encrypted data stored in the vault._

----------
### Accessing the System
Once the server is running and the Master Unlock Key has been entered via the console prompt, navigate to:

```
http://localhost:3000
```

Create your initial account, log in, and optionally update your `.env` file to set `DISABLE_REGISTRATION=true` to secure the perimeter.

  

----------

## 👥 Role Permissions Reference (RBAC)

  


| Action                              | Manager | Contributor | Viewer |
|-------------------------------------|:-------:|:----------:|:------:|
| Add users / manage existing case users | Yes     | No         | No     |
| Upload evidence files                | Yes     | Yes        | No     |
| Verify evidence file integrity       | Yes     | Yes        | Yes    |
| View / Download evidence files       | Yes     | Yes        | Yes    |
| Delete evidence files                | Yes     | No         | No     |
| Generate full case / single file PDFs| Yes     | Yes        | Yes    |

  

----------

  
  

## 🛑 Troubleshooting

-  **`MongoNetworkError` on server start:** MongoDB is not running. Open `services.msc` and start the MongoDB service.

-  **`Cannot find module` on start:** Dependencies are missing. Run `npm install` from the project directory.

-  **Master Key Lost:** If you are testing and lose the key, you must drop the `daemon_vault` database via MongoDB Compass and restart the server to generate a new key (Note: This permanently deletes all existing data).

  

----------

_**Disclaimer:** This repository contains the software artefact developed solely for submission as part of a university dissertation project. It is a **proof-of-concept** and **not intended for deployment** in any real-world digital forensics environment._

_The software is **not maintained**, and I **take no responsibility** for any use, hosting, or deployment of this project, including its use as a Digital Evidence Management System (DEMS) or in any operational context. Use of this software is entirely at your own risk._