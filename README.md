```markdown
# Audit System Project

# https://audit-system-project.onrender.com/

**PBL Mini Project **

A full-stack web application designed for internal audit management and purchase request verification. This system features a professional dashboard, role-based access control for Users and Auditors, and a real-time compliance verification tool.

---

## 📖 Table of Contents
- [About The Project](#-about-the-project)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Usage](#-usage)
- [Security Implementations](#-security-implementations)
- [API Endpoints](#-api-endpoints)
- [Database Schema](#-database-schema)

---

## 🏛️ About The Project

This application streamlines the audit process for organizations. Standard users can submit purchase requests with detailed invoice information, while auditors can review, verify, and take action on these submissions. 

The frontend utilizes a clean, responsive design with a professional blue-slate color palette, while the backend ensures data integrity through SQLite and secure session handling.

---

## ✨ Features

### User Functionalities
- **Authentication**: Secure Register and Login system.
- **Request Portal**: Create detailed purchase requests (Vendor, Amount, Invoice Details).
- **Real-Time Tracking**: View submission status (Pending Review, Verified, Rejected) instantly.
- **Audit Feedback**: View rejection reasons or notes left by Auditors.

### Auditor Functionalities
- **Authority Overview**: View all assigned requests in a centralized dashboard.
- **Action Management**: Approve or Reject submissions with mandatory notes.
- **Verify Tool**: A built-in tool to check invoice validity and generate compliance reports (GST, CARO 2020).
- **Smart Assignment**: New requests are automatically assigned to the auditor with the least pending tasks.

### System Features
- **Role-Based Access**: Distinct dashboards and permissions for `USER` and `AUDITOR` roles.
- **Smart Assignment Algorithm**: Automatically balances workload among auditors.
- **Data Persistence**: Lightweight SQLite database with WAL mode for performance.
- **Security**: Password hashing, session management, and input validation.

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3 (CSS Variables, Grid, Flexbox)
- Vanilla JavaScript (ES6+) (Single Page Application)
- [Google Fonts](https://fonts.google.com/) (Inter)

**Backend:**
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)

**Database:**
- [SQLite3](https://www.sqlite.org/index.html) (File-based SQL)

**Security & Utils:**
- `bcrypt` (Password Hashing)
- `express-session` (Session Management)
- `helmet` (HTTP Security Headers)
- `Joi` (Input Validation)

---

## 📂 Project Structure

To run this project correctly, place your files in the following structure:


```

audit-system-project/
├── public/              # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── data/                # Database storage (auto-created)
├── server.js            # Main application entry point
├── db.js                # Database configuration
├── package.json         # Dependencies
└── README.md

```

---

## 🚀 Getting Started

### Prerequisites
- Node.js installed on your machine.

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/Hariharan-0712/audit-system-project.git](https://github.com/Hariharan-0712/audit-system-project.git)

```

2. **Navigate to the folder**
```bash
cd audit-system-project

```


3. **Install Dependencies**
```bash
npm install

```


4. **Run the Server**
```bash
node server.js

```


5. **Access the App**
Open your browser and go to: `http://localhost:3000`

---

## 💻 Usage

### Default Credentials

The system automatically seeds two default accounts for testing:

| Role | Username | Password |
| --- | --- | --- |
| Auditor | `auditor` | `auditor123` |
| User | `user` | `user123` |

### User Workflow

1. Log in as a **User**.
2. Navigate to **New Request**.
3. Fill in Purchase Details (Vendor, Amount, Invoice Number, Date).
4. Submit the request. It will be automatically assigned to an Auditor.

### Auditor Workflow

1. Log in as an **Auditor**.
2. View pending requests on the Dashboard.
3. Click **View** to inspect details.
4. **Approve** or **Reject** the request with notes.
5. Alternatively, use the **Verify Tool** to generate a risk assessment report based on invoice data.

---

## 🔒 Security Implementations

1. **Password Hashing**: User passwords are hashed using `bcrypt` before storage. Plain text passwords are never saved.
2. **Session Management**: Uses `express-session` with `httpOnly` cookies to prevent client-side script access.
3. **HTTP Headers**: Utilizes `helmet` to set secure HTTP headers, protecting against common web vulnerabilities.
4. **Input Validation**: Uses `Joi` to validate registration inputs, preventing malformed data entry.
5. **Role-Based Access Control (RBAC)**: Routes are protected by middleware (`requireAuth`) to ensure only authorized users can access specific API endpoints.

---

## 🛣️ API Endpoints

| Method | Endpoint | Description | Access |
| --- | --- | --- | --- |
| POST | /api/register | Register a new user | Public |
| POST | /api/login | Authenticate user & start session | Public |
| POST | /api/logout | End user session | Public |
| GET | /api/me | Get current logged-in user details | Private |
| GET | /api/audits | Get all audits (User: own, Auditor: assigned) | Private |
| POST | /api/audits | Create a new audit request | User |
| PUT | /api/audits/:id | Update status (Approve/Reject) | Auditor |

---

## 🗄️ Database Schema

### Users Table

| Column | Type | Description |
| --- | --- | --- |
| id | INTEGER | Primary Key |
| username | TEXT | Unique username |
| password | TEXT | Hashed password |
| role | TEXT | 'USER' or 'AUDITOR' |
| created_at | DATETIME | Account creation timestamp |

### Audits Table

| Column | Type | Description |
| --- | --- | --- |
| id | INTEGER | Primary Key |
| title | TEXT | Title of the request |
| assigned_to | INTEGER | Foreign Key (Users) |
| created_by | INTEGER | Foreign Key (Users) |
| purchase_data | TEXT | JSON string of invoice details |
| status | TEXT | 'PENDING_REVIEW', 'VERIFIED', etc. |
| admin_notes | TEXT | Feedback from auditor |
| created_at | DATETIME | Submission timestamp |

---

made with ❤️ by HARIHARAN
