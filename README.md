# mernsm – Admin auth

## Setup
1. Backend: `cd backend && cp .env.example .env` → fill in `MONGO_URI`, `JWT_SECRET`, `ADMIN_SECRET_CODE`, then `npm install && npm run dev`
2. Frontend: `cd frontend && npm install && npm run dev`
3. Open http://localhost:5173/admin/register (use your `ADMIN_SECRET_CODE`), then /admin/login

## Structure
backend/server.js
backend/src/config/db.js            MongoDB connection
backend/src/admin/                  everything admin
  models/ controllers/ routes/ middleware/ utils/
frontend/src/admin/                 everything admin (UI)
  api/ context/ components/ pages/ AdminRoutes.jsx admin.css
