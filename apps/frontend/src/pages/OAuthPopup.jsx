import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import Logo from '../components/Logo';

function OAuthPopup() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState('processing');

    useEffect(() => {
        const handleOAuthCallback = async () => {
            try {
                const token = searchParams.get('token');
                const error = searchParams.get('error');

                if (error) {
                    console.error('OAuth error:', error);
                    setStatus('error');
                    // Send error message to parent window
                    window.opener?.postMessage({
                        type: 'OAUTH_ERROR',
                        error: error
                    }, window.location.origin);
                    return;
                }

                if (!token) {
                    console.error('No token received');
                    setStatus('error');
                    window.opener?.postMessage({
                        type: 'OAUTH_ERROR',
                        error: 'No authentication token received'
                    }, window.location.origin);
                    return;
                }

                // Validate the token
                try {
                    const decoded = jwtDecode(token);
                    const currentTime = Date.now() / 1000;
                    
                    if (decoded.exp && decoded.exp < currentTime) {
                        throw new Error('Token has expired');
                    }
                } catch (decodeError) {
                    console.error('Token validation failed:', decodeError);
                    setStatus('error');
                    window.opener?.postMessage({
                        type: 'OAUTH_ERROR',
                        error: 'Invalid or expired token'
                    }, window.location.origin);
                    return;
                }

                // Success - send token to parent window
                console.log('OAuth successful, sending token to parent window');
                setStatus('success');
                window.opener?.postMessage({
                    type: 'OAUTH_SUCCESS',
                    token: token
                }, window.location.origin);

                // Close popup after a short delay
                setTimeout(() => {
                    window.close();
                }, 1000);

            } catch (err) {
                console.error('OAuth popup error:', err);
                setStatus('error');
                window.opener?.postMessage({
                    type: 'OAUTH_ERROR',
                    error: err.message || 'Authentication failed'
                }, window.location.origin);
            }
        };

        handleOAuthCallback();
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
                <div className="flex items-center justify-center mb-6">
                    <Logo size="default" />
                    <h1 className="text-2xl font-bold text-gray-900">MongoSnap</h1>
                </div>
                
                {status === 'processing' && (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Completing Authentication</h2>
                        <p className="text-gray-600">Please wait while we complete your Google sign-in...</p>
                    </>
                )}
                
                {status === 'success' && (
                    <>
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Successful!</h2>
                        <p className="text-gray-600">You have been successfully signed in. This window will close automatically.</p>
                    </>
                )}
                
                {status === 'error' && (
                    <>
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Failed</h2>
                        <p className="text-gray-600">There was an error during the authentication process. Please try again.</p>
                        <button 
                            onClick={() => window.close()}
                            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            Close Window
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default OAuthPopup; 