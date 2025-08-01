import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider } from './contexts/UserContext'
import { useContext } from 'react'
import { UserContext } from './contexts/UserContext'
import Home from './pages/Home'
import PublicHome from './pages/PublicHome'
import About from './pages/About'
import Contact from './pages/Contact'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ProtectedRoute from './ProtectedRoutes.jsx'
import OAuthSuccess from './pages/OAuthSuccess'
import OAuthPopup from './pages/OAuthPopup'
import Connect from './pages/connect.jsx'
import Playground from './pages/Playground.jsx'
import SettingsPage from './pages/Settings.jsx'
import Pricing from './pages/Pricing.jsx'
import PaymentSuccess from './pages/PaymentSuccess.jsx'
import PaymentFailure from './pages/PaymentFailure.jsx'
import Prolicy from './pages/Prolicy.jsx'
import Teervice from './pages/Teervice.jsx'
import Reolicy from './pages/Reolicy.jsx'
import AdminBugReports from './components/AdminBugReports.jsx'

// Component to handle conditional redirect for root path
const ConditionalHome = () => {
  const { loading } = useContext(UserContext);
  
  // Show loading state while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }
  
  // Redirect authenticated users to /me, otherwise show PublicHome
  
  
  return <PublicHome />;
};

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<ConditionalHome />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/failure" element={<PaymentFailure />} />
        <Route path="/privacy-policy" element={<Prolicy />} />
        <Route path="/terms-of-service" element={<Teervice />} />
        <Route path="/refund-policy" element={<Reolicy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/change-password/:token" element={<ResetPassword />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/oauth-popup" element={<OAuthPopup />} />
        
        {/* Protected Routes */}
        <Route path="/me" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/connect" element={<ProtectedRoute><Connect /></ProtectedRoute>} />
        <Route path="/playground" element={<ProtectedRoute><Playground /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute><AdminBugReports /></ProtectedRoute>} />
      </Routes>
      </UserProvider>
    </BrowserRouter>
  )
}

export default App