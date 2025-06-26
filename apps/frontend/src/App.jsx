import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { UserProvider } from './contexts/UserContext'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './ProtectedRoutes.jsx'
import OAuthSuccess from './pages/OAuthSuccess'
import OAuthPopup from './pages/OAuthPopup'
import Connect from './pages/connect.jsx'
import ConnectionStatus from './pages/ConnectionStatus.jsx'

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        {/* <Route path="/" element={<Home />} /> */}
        <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
        <Route path="/connection-status" element={<ProtectedRoute><ConnectionStatus /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/oauth-popup" element={<OAuthPopup />} />
      </Routes>
      </UserProvider>
    </BrowserRouter>
  )
}

export default App