OPERATION MANAGER PANEL
=======================
Unzip into your project root (the folder that contains "frontend" and "backend").
It replaces the files listed below. RESTART THE BACKEND afterwards.

HOW TO CREATE AN OPERATION MANAGER
  Log in as admin -> Users -> choose the new "Operation Manager" role -> Create.
  They sign in on the normal login page and land on /om.

The panel is manage-only, under /om:
  Dashboard, Invoices, Meetings, Creatives, Attendance, Calendar, Settings, Playlist.
  There is NO Users or Companies page: adding/changing/deleting users and
  companies stays with the admin (also blocked on the server).

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


NOTIFICATIONS WITH SOUND  (added on top of the Operation Manager panel)
=======================================================================
Restart the backend after unzipping. No new npm packages are needed.

WHAT THE USER SEES
  * A bell in the top bar with an unread count; click it for the list.
    From there: mark all read, clear all, and turn the sound on/off.
  * When something new arrives (the app checks every 5 seconds): a toast slides
    in, a sound plays, and the browser tab shows "(3) ..." in its title.
  * Clicking a notification opens the right page for that person's role.
  * Your OWN actions also give sound feedback: a soft tick when it worked,
    a low buzz when it failed. (Reading data, login/logout and music stay silent.)
  * Sounds are generated in the browser, so there are no audio files. Browsers
    only allow sound after the first click/keypress on the page.

WHO GETS NOTIFIED
  SME submits / resubmits a creative ........ admins, operation managers, the SME's reporting manager
  Creative approved / rejected .............. the SME
  Creative assigned to a designer ........... the designer
  Designer uploads a design ................. the SME
  SME approves / asks redo on a design ...... the designer
  SME schedules a meeting ................... admins, operation managers, reporting manager
  SME submits a MOM ......................... admins, operation managers, reporting manager
  MOM approved / sent back / rejected ....... the SME
  SME creates a task for an SMI ............. the SMI
  SMI starts / completes a task ............. the SME who gave it
  SME completes a task ...................... admins, operation managers, reporting manager
  SME assigns an SOP to an SMI .............. the SMI
  Admin assigns an SOP / companies .......... that user
  Admin adds a user under a reporting mgr ... the reporting manager
  Invoice created ........................... admins and operation managers
  (The person who did the action is never notified about their own action.)

NEW FILES
backend/notifications/Notification.js        notifications collection (auto-deleted after 60 days)
backend/notifications/notify.js              helper used by the routes below (never breaks an action if it fails)
backend/notifications/notificationRoutes.js  GET /api/notifications, PUT /read-all, PUT /:id/read, DELETE /
frontend/src/notifications/sound.js
frontend/src/notifications/NotificationContext.jsx
frontend/src/notifications/NotificationBell.jsx
frontend/src/styles/notifications.css

CHANGED (notifications only)
backend/server.js, backend/sme/smeRoutes.js, backend/smi/smiRoutes.js, backend/des/desRoutes.js,
backend/review/reviewCore.js, backend/admin/adminRoutes.js, backend/invoices/invoiceRoutes.js,
frontend/src/api.js, frontend/src/Topbar.jsx, frontend/src/App.jsx

IF YOU HEAR NOTHING
  1. Click the bell -> press the "Test sound" (bell-ring) button. If that is silent, check the
     tab is not muted in the browser and the computer volume is up.
  2. Browsers keep sound blocked until you click or press a key on the page once. After a
     refresh it is blocked again; the bell panel shows a yellow hint while that is the case.
  3. If you run the built app (served by the backend on port 5000) you must rebuild the frontend:
         cd frontend && npm run build
     With "npm run dev" nothing extra is needed.
  4. Sound can be turned off in the bell panel (speaker icon): make sure it shows the speaker, not the crossed one.
