import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminRoutes from './admin/AdminRoutes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
