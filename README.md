# mernsm – Admin auth

## Setup
1. Backend: `cd backend && cp .env.example .env` -> fill in `MONGO_URI`, `JWT_SECRET`, and `ADMIN_EMAIL` / `ADMIN_PASSWORD` (creates the first admin on first start), then `npm install && npm run dev`
2. Frontend: `cd frontend && npm install && npm run dev`
3. Open http://localhost:5173/login and sign in with the admin email + password

## Structure
backend/server.js
backend/src/config/db.js            MongoDB connection
backend/src/admin/                  everything admin
  models/ controllers/ routes/ middleware/ utils/
frontend/src/admin/                 everything admin (UI)
  api/ context/ components/ pages/ AdminRoutes.jsx admin.css

## Users & login
- There is no register page. One login for everyone: http://localhost:5173/login (email or User ID + password)
- The first admin is created from ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env when the database has no admin
<<<<<<< HEAD
- Admins define up to 5 companies (name + logo) under Admin > Companies, then add users under Admin > Users (Full Name, Reporting Manager, Contact, Email, Role, tick Assigned Companies); each gets an auto User ID (USR-0001...) and a generated temporary password shown once
- Users log in at /login and land on their own dashboard (SME -> /sme/dashboard: welcome + name, live date/time/week, 5 company badges (grey = not assigned), and their SOPs); admins review SOPs under Admin > SOP Review
=======
- Admins add users under Admin > Users (Full Name, Reporting Manager, Contact, Email, Role, Assigned Companies); each gets an auto User ID (USR-0001...) and a generated temporary password shown once
- Users log in at /login and land on their own dashboard (SME -> /sme/dashboard, where they write SOPs); admins review SOPs under Admin > SOP Review
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
- backend/src/admin/ (models/User.js, controllers/users.controller.js), backend/src/sme/, backend/src/auth/, backend/src/config/seedAdmin.js
