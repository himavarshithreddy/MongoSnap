import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserProvider } from './contexts/UserContext'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './ProtectedRoutes.jsx'
import OAuthSuccess from './pages/OAuthSuccess'
import OAuthPopup from './pages/OAuthPopup'
import Connect from './pages/connect.jsx'
import Playground from './pages/Playground.jsx'
import SettingsPage from './pages/Settings.jsx'

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        {/* <Route path="/" element={<Home />} /> */}
        <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
        <Route path="/playground" element={<ProtectedRoute><Playground /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/change-password/:token" element={<ResetPassword />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/oauth-popup" element={<OAuthPopup />} />
      </Routes>
      </UserProvider>
    </BrowserRouter>
  )
}

export default App