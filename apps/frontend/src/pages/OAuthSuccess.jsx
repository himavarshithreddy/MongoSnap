import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

function OAuthSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOAuthSuccess = async () => {
      try {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
          setError(`OAuth Error: ${error}`);
          setLoading(false);
          return;
        }

        if (!token) {
          setError('No authentication token received');
          setLoading(false);
          return;
        }

        // Validate the token format
        try {
          const decoded = jwtDecode(token);
          const currentTime = Date.now() / 1000;
          
          if (decoded.exp && decoded.exp < currentTime) {
            setError('Token has expired');
            setLoading(false);
            return;
          }
          
          console.log('Token is valid, expires at:', new Date(decoded.exp * 1000));
        } catch {
          setError('Invalid token format');
          setLoading(false);
          return;
        }

        // Store the token
        localStorage.setItem('token', token);
        
        // Small delay to ensure token is stored
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify token is stored
        const storedToken = localStorage.getItem('token');
        if (storedToken !== token) {
          setError('Failed to store authentication token');
          setLoading(false);
          return;
        }

        console.log('OAuth successful, navigating to home...');
        navigate('/', { replace: true });
        
      } catch (err) {
        console.error('OAuth success error:', err);
        setError('Failed to complete authentication');
        setLoading(false);
      }
    };

    handleOAuthSuccess();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg">Completing your login...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Authentication Failed</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default OAuthSuccess;
