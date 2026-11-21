OPERATION MANAGER PANEL
=======================
Unzip into your project root (the folder that contains "frontend" and "backend").
It replaces the files listed below. RESTART THE BACKEND afterwards.

HOW TO CREATE AN OPERATION MANAGER
  Log in as admin -> Users -> choose the new "Operation Manager" role -> Create.
  They sign in on the normal login page and land on /om.

The panel is a copy of the admin panel (same pages, same API), under /om:
  Dashboard, Users, Companies, Invoices, Meetings, Creatives, Attendance,
  Calendar, Settings, Playlist.

BACKEND
backend/admin/UserModels.js            new OperationManager model (collection: operation_managers)
backend/admin/adminRoutes.js           admin endpoints now also allow operation_manager
backend/attendance/Attendance.js       role enum includes operation_manager
backend/attendance/geo.js              operation_manager follows the same office-location rule as admin
backend/invoices/invoiceRoutes.js      invoices open to operation_manager
backend/invoices/Invoice.js            createdByRole enum includes operation_manager
backend/meeting/integrationRoutes.js   Google connect redirects back to /om/meetings
backend/server.js                      /api/admin/dashboard allows operation_manager

FRONTEND
frontend/src/App.jsx                   /om/* routes + redirect
frontend/src/navConfig.js              OM_NAV (admin menu under /om)
frontend/src/roleNames.js              "Operation Manager" label
frontend/src/Login.jsx                 redirect to /om after login
frontend/src/Sidebar.jsx               /om treated as a home link
frontend/src/Topbar.jsx                greeting + workspace label
frontend/src/styles/theme.css          role badge colour
frontend/src/admin/AdminDashboard.jsx  links follow the panel (base prop)
frontend/src/admin/AdminUsers.jsx      Operation Manager appears in the role list
frontend/src/admin/AdminAttendance.jsx Operation Manager appears in attendance groups
