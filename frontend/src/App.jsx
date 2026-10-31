import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminRoutes from './admin/AdminRoutes'
import SmeRoutes from './sme/SmeRoutes'
import Login from './auth/Login'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="/sme/*" element={<SmeRoutes />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
