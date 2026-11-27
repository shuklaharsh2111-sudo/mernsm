// Everything super admin on the server lives in this folder.
//   ensureSuperAdmin  creates / syncs the super admin account from .env on every start
//   superRoutes       /api/superadmin/*  (overall dashboard, super admin rights, departments) - super admin only
export { ensureSuperAdmin } from './ensureSuperAdmin.js';
export { default as superRoutes } from './routes.js';
