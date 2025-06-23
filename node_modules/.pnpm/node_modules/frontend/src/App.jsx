import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './ProtectedRoutes.jsx'
import OAuthSuccess from './pages/OAuthSuccess'
import OAuthPopup from './pages/OAuthPopup'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/oauth-popup" element={<OAuthPopup />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App