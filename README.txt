Unzip into your project root (the folder that contains "frontend" and "backend").
It replaces these 11 files. RESTART THE BACKEND afterwards.

BACKEND
backend/sme/SocialMetrics.js   numbers are now stored per platform (one record per company + month + platform);
                               drops the old unique index once on start-up so a 2nd platform can be saved
backend/sme/smeRoutes.js       /social-metrics takes ?platform=...; /monthly-report takes ?platform=... (optional)

FRONTEND
frontend/src/sme/SmeMonthlyReports.jsx          platform dropdown drives the whole report
frontend/src/components/MonthlyPerformance.jsx  performance part follows the chosen platform
frontend/src/components/TaskDetailsModal.jsx    Task Overview popup layout
frontend/src/components/SocialIcons.jsx         small slim platform logos
frontend/src/sme/SmeCalendar.jsx                smaller logos in the calendar
frontend/src/styles/monthlyreport.css
frontend/src/styles/taskdetailsmodal.css
frontend/src/styles/calendar-layout.css
