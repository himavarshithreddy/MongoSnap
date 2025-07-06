import {React, useEffect, useState} from 'react'
import { Eye, EyeOff, Plus, Trash2, Database, Clock, Info, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import Logo from '../components/Logo';
import SettingsModal from '../components/Settings';

function Connect() {
    useEffect(() => {
        document.title = "MongoSnap - Connect";
    }, []);

    const navigate = useNavigate();
    const [nickname, setNickname] = useState('');
    const [connectionURI, setConnectionURI] = useState('');
    const [uriError, setUriError] = useState('');
    const [nicknameError, setNicknameError] = useState('');
    const [showCredentials, setShowCredentials] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sampleLoading, setSampleLoading] = useState(false);
    const [connectionsLoading, setConnectionsLoading] = useState(false);
    const [error, setError] = useState('');
    const [limitError, setLimitError] = useState('');
    const [success, setSuccess] = useState('');
    const [loadedConnection, setLoadedConnection] = useState(null);
    const [testingConnection, setTestingConnection] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // Auto-dismiss instructions timer
    const [instructionsTimer, setInstructionsTimer] = useState(null);
    const [serverIP, setServerIP] = useState('Loading...');
    
    // Use cached user data from context
    const { user, loading: userLoading, error: userError, logout, fetchWithAuth } = useUser();
    
    // Previous connections state
    const [previousConnections, setPreviousConnections] = useState([]);

    // MongoDB URI validation regex (requires database name)
    const mongoUriRegex = /^mongodb(?:\+srv)?:\/\/.+:.+@.+\/[^?]+(?:\?.*)?$/;

    // Load connections on component mount
    useEffect(() => {
        const fetchConnections = async () => {
            if (!user) return;
            
            setConnectionsLoading(true);
            try {
                console.log('Fetching connections for user:', user._id);
                const response = await fetchWithAuth('/api/connection');
                console.log('Response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Connections data:', data);
                    setPreviousConnections(data.connections || []);
                } else {
                    const errorData = await response.json();
                    console.error('Error response:', errorData);
                    setError(errorData.message || 'Failed to load connections');
                }
            } catch (error) {
                console.error('Error fetching connections:', error);
                setError('Failed to load connections');
            } finally {
                setConnectionsLoading(false);
            }
        };
        
        fetchConnections();
    }, [user, fetchWithAuth]);

    // Cleanup instructions timer on unmount
    useEffect(() => {
        return () => {
            if (instructionsTimer) {
                clearTimeout(instructionsTimer);
            }
        };
    }, [instructionsTimer]);

    // Fetch server IP on component mount
    useEffect(() => {
        const fetchServerIP = async () => {
            try {
                const response = await fetch('/api/connection/server-ip');
                if (response.ok) {
                    const data = await response.json();
                    setServerIP(data.serverIP);
                } else {
                    setServerIP('Contact support for IP');
                }
            } catch (error) {
                console.error('Error fetching server IP:', error);
                setServerIP('Contact support for IP');
            }
        };

        fetchServerIP();
    }, []);

    // Helper to mask credentials in URI
    const getMaskedURI = (uri) => {
        // Return empty string if URI is empty
        if (!uri || uri.trim() === '') return '';
        
        // Only mask if it matches the expected pattern
        const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/);
        if (!match) {
            // If it doesn't match the pattern, return as-is (no credentials to mask)
            return uri;
        }
        
        const [, protocol, , , rest] = match;
        return `${protocol}••••••:••••••@${rest}`;
    };

    // Helper to format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Get first letter of username
    const getFirstLetter = (username) => {
        return username ? username.charAt(0).toUpperCase() : 'U';
    };

    // Handle logout - using context logout function
    const handleLogout = async () => {
        setShowProfileModal(false);
        await logout();
    };

    // Load connection into form
    const loadConnection = async (connection) => {
        try {
            const response = await fetchWithAuth(`/api/connection/${connection._id}`);
            if (response.ok) {
                const data = await response.json();
                setNickname(data.connection.nickname);
                setConnectionURI(data.connection.uri);
                setShowCredentials(false);
                setUriError('');
                setNicknameError('');
                setError('');
                setLimitError('');
                // Store the loaded connection for testing
                setLoadedConnection(data.connection);
            } else {
                const errorData = await response.json();
                setLimitError('');
                setError(errorData.message || 'Failed to load connection');
            }
        } catch (error) {
            console.error('Error loading connection:', error);
            setLimitError('');
            setError('Failed to load connection');
        }
    };

    // Remove connection
    const removeConnection = async (id) => {
        try {
            console.log('Removing connection with ID:', id);
            const response = await fetchWithAuth(`/api/connection/${id}`, {
                method: 'DELETE'
            });
            console.log('Remove response status:', response.status);
            
            if (response.ok) {
                setPreviousConnections(prev => prev.filter(conn => conn._id !== id));
                setSuccess('Connection removed successfully');
                setError('');
                setLimitError('');
                setTimeout(() => setSuccess(''), 3000);
                // Clear loaded connection if it was the one removed
                if (loadedConnection && loadedConnection._id === id) {
                    setLoadedConnection(null);
                    setNickname('');
                    setConnectionURI('');
                }
            } else {
                const errorData = await response.json();
                console.error('Remove error response:', errorData);
                setLimitError('');
                setError(errorData.message || 'Failed to remove connection');
            }
        } catch (error) {
            console.error('Error removing connection:', error);
            setLimitError('');
            setError('Failed to remove connection');
        }
    };

    // Check connection limits
    const checkConnectionLimits = async () => {
        try {
            const response = await fetchWithAuth('/api/connection/limits');
            if (response.ok) {
                const data = await response.json();
                return data.limits.canCreateMore;
            }
            return true; // If we can't check, assume it's OK
        } catch (error) {
            console.error('Error checking connection limits:', error);
            return true; // If we can't check, assume it's OK
        }
    };

    // Handle form submission
    const handleConnect = async (e) => {
        e.preventDefault();
        let valid = true;
        setUriError('');
        setNicknameError('');
        setError('');
        setLimitError('');
        setSuccess('');
        
        if (!nickname.trim()) {
            setNicknameError('Nickname is required');
            valid = false;
        }
        if (!connectionURI.trim()) {
            setUriError('MongoDB URI is required');
            valid = false;
        } else {
            // Check if URI has database name
            const uri = connectionURI.trim();
            const hasDatabaseName = /^mongodb(?:\+srv)?:\/\/.+:.+@.+\/[^?/]+(?:\?.*)?$/.test(uri);
            
            if (!hasDatabaseName) {
                setUriError('Database name is required in the URI (e.g., /mydatabase)');
                valid = false;
            } else if (!mongoUriRegex.test(uri)) {
                setUriError('Please enter a valid MongoDB connection URI');
                valid = false;
            }
        }
        if (!valid) {
            // Auto-expand instructions on validation failure
            setShowInstructions(true);
            autoDismissInstructions();
            return;
        }

        // Check connection limits before testing (only for new connections)
        if (!loadedConnection) {
            const canCreateMore = await checkConnectionLimits();
            if (!canCreateMore) {
                setLimitError('limit_reached');
                return;
            }
        }
        
        setLoading(true);
        
        try {
            console.log('Connecting to database:', { nickname: nickname.trim(), uri: connectionURI.trim() });
            
            // Use the new connect endpoint
            const connectResponse = await fetchWithAuth('/api/connection/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: nickname.trim(),
                    uri: connectionURI.trim(),
                    connectionId: loadedConnection ? loadedConnection._id : null
                })
            });
            
            console.log('Connect response status:', connectResponse.status);
            
            if (connectResponse.ok) {
                const data = await connectResponse.json();
                console.log('Connect response data:', data);
                
                // Add new connection to list if it's a new connection
                if (data.connection.isNewConnection) {
                    setPreviousConnections(prev => [data.connection, ...prev]);
                }
                
                // Navigate to connection status page
                navigate(`/playground?connectionId=${data.connection._id}`);
            } else {
                const errorData = await connectResponse.json();
                console.error('Connect error response:', errorData);
                
                // Handle connection limit errors with less prominent styling
                if (connectResponse.status === 429 && errorData.message.includes('Connection limit')) {
                    setLimitError('limit_reached');
                } else {
                    setError(errorData.message || 'Failed to connect to database');
                    // Auto-expand instructions on connection failure (but not for limit errors)
                    setShowInstructions(true);
                    autoDismissInstructions();
                }
            }
        } catch (error) {
            console.error('Error connecting to database:', error);
            setLimitError('');
            setError('Failed to connect to database');
            // Auto-expand instructions on connection failure
            setShowInstructions(true);
            autoDismissInstructions();
        } finally {
            setLoading(false);
        }
    };

    // Test connection
    const testConnection = async () => {
        // Validate only URI before testing
        let valid = true;
        setUriError('');
        setError('');
        setLimitError('');
        setSuccess('');
        
        if (!connectionURI.trim()) {
            setUriError('MongoDB URI is required');
            valid = false;
        } else {
            // Check if URI has database name
            const uri = connectionURI.trim();
            const hasDatabaseName = /^mongodb(?:\+srv)?:\/\/.+:.+@.+\/[^?/]+(?:\?.*)?$/.test(uri);
            
            if (!hasDatabaseName) {
                setUriError('Database name is required in the URI (e.g., /mydatabase)');
                valid = false;
            } else if (!mongoUriRegex.test(uri)) {
                setUriError('Please enter a valid MongoDB connection URI');
                valid = false;
            }
        }
        
        if (!valid) {
            // Auto-expand instructions on validation failure
            setShowInstructions(true);
            autoDismissInstructions();
            return;
        }
        
        setTestingConnection(true);
        
        try {
            console.log('Testing connection with URI:', connectionURI.trim());
            
            // Test the current URI in the form
            const response = await fetch('/api/connection/test-uri', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uri: connectionURI.trim()
                })
            });
            
            console.log('Test response status:', response.status);
            
            if (response.ok) {
                setSuccess('Connection test successful! The URI is valid and accessible.');
            } else {
                const errorData = await response.json();
                console.error('Test error response:', errorData);
                setError(errorData.message || 'Connection test failed');
                // Auto-expand instructions on test failure
                setShowInstructions(true);
                autoDismissInstructions();
            }
        } catch (error) {
            console.error('Error testing connection:', error);
            setLimitError('');
            setError('Failed to test connection');
            // Auto-expand instructions on test failure
            setShowInstructions(true);
            autoDismissInstructions();
        } finally {
            setTestingConnection(false);
        }
    };

    // Auto-dismiss instructions after 5 seconds
    const autoDismissInstructions = () => {
        if (instructionsTimer) {
            clearTimeout(instructionsTimer);
        }
        const timer = setTimeout(() => {
            setShowInstructions(false);
        }, 5000); // 5 seconds
        setInstructionsTimer(timer);
    };

    // Clear auto-dismiss timer when instructions are manually toggled
    const toggleInstructions = () => {
        if (instructionsTimer) {
            clearTimeout(instructionsTimer);
            setInstructionsTimer(null);
        }
        setShowInstructions(!showInstructions);
    };

    // Auto-dismiss instructions when user starts typing
    const handleInputChange = (e) => {
        if (showInstructions) {
            autoDismissInstructions();
        }
        // Call the original onChange handler
        if (e.target.name === 'nickname') {
            setNickname(e.target.value);
        } else if (e.target.name === 'connectionURI') {
            if (showCredentials || !e.target.value.includes('••••••')) {
                setConnectionURI(e.target.value);
            }
        }
    };

    // Copy to clipboard function with fallback
    const copyToClipboard = async (text, elementId) => {
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            
            // Show success feedback
            const element = document.getElementById(elementId) || event.target;
            const originalText = element.textContent;
            const originalClasses = element.className;
            
            element.textContent = 'Copied!';
            element.className = originalClasses + ' text-green-400';
            
            setTimeout(() => {
                element.textContent = originalText;
                element.className = originalClasses;
            }, 1000);
            
        } catch (err) {
            console.error('Failed to copy text: ', err);
            // Show error feedback
            const element = document.getElementById(elementId) || event.target;
            const originalText = element.textContent;
            const originalClasses = element.className;
            
            element.textContent = 'Copy failed';
            element.className = originalClasses + ' text-red-400';
            
            setTimeout(() => {
                element.textContent = originalText;
                element.className = originalClasses;
            }, 1000);
        }
    };

    // Handle sample database connection
    const handleSampleDatabase = async () => {
        setSampleLoading(true);
        setError('');
        setLimitError('');
        setSuccess('');
        
        try {
            console.log('Connecting to sample database...');
            
            const response = await fetchWithAuth('/api/connection/sample', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('Sample database response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Sample database response data:', data);
                
                // Navigate to playground with sample database
                navigate(`/playground?connectionId=${data.connection._id}&isSample=true`);
            } else {
                const errorData = await response.json();
                console.error('Sample database error response:', errorData);
                setError(errorData.message || 'Failed to connect to sample database');
            }
        } catch (error) {
            console.error('Error connecting to sample database:', error);
            setError('Failed to connect to sample database');
        } finally {
            setSampleLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex">
        {/* Mobile View - Show message to use desktop */}
        <div className="md:hidden min-h-screen w-full bg-brand-primary flex flex-col items-center justify-center px-6 text-center">
            <div className='flex items-center mb-8'>
                <Logo size="large" />
                <h1 className='text-3xl font-bold text-white tracking-wide'>Mongo<span className='text-brand-quaternary'>Snap</span></h1>
            </div>
            
            <div className='bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary max-w-sm'>
                <div className='mb-6'>
                    
                    <h2 className='text-white text-xl font-bold mb-2'>Desktop Required</h2>
                    <p className='text-gray-300 text-sm leading-relaxed'>
                        Database connections require a desktop or PC environment for optimal security and functionality.
                    </p>
                </div>
                
                <div className='bg-brand-tertiary rounded-lg p-4 mb-6'>
                    <h3 className='text-white font-semibold mb-2 text-sm'>Please use:</h3>
                    <ul className='text-gray-300 text-xs space-y-1 text-left'>
                        <li>• Desktop computer</li>
                        <li>• Laptop</li>
                        <li>• Tablet in desktop mode</li>
                    </ul>
                </div>
                
                <button
                    onClick={() => navigate('/login')}
                    className='w-full bg-brand-tertiary text-white py-2 px-4 rounded-md font-medium hover:bg-opacity-90 transition-all duration-200'
                >
                    Back to Login
                </button>
            </div>
        </div>

        {/* Desktop View - Original content */}
        <div className="hidden md:flex min-h-screen w-full">
        <div className="w-[20%] min-h-screen flex flex-col bg-brand-secondary">
            <div className='flex items-center mb-6 p-4 border-b border-brand-tertiary'>
                <Logo size="default" />
                <h1 className='md:text-3xl text-3xl font-bold text-white tracking-wide'>Mongo<span className='text-brand-quaternary'>Snap</span></h1>
            </div>
            
            <div className='flex flex-col gap-4 px-4 flex-1 overflow-hidden'>
                {/* Sample Database Section */}
                <div className='bg-brand-quaternary/20 border border-brand-quaternary/30 rounded-lg p-4'>
                    <div className='text-center mb-3'>
                        <h3 className='text-white font-semibold mb-1 text-sm'>Try MongoSnap</h3>
                        <p className='text-gray-300 text-xs'>
                            Explore features with our sample database
                        </p>
                    </div>
                    
                    <button
                        onClick={handleSampleDatabase}
                        disabled={sampleLoading}
                        className={`w-full py-2 px-3 rounded-md bg-brand-quaternary/70 text-white text-sm font-medium hover:bg-brand-quaternary hover:scale-102 transition-all duration-300 cursor-pointer border border-brand-quaternary/50 ${sampleLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {sampleLoading ? 'Connecting...' : 'Try Sample Database'}
                    </button>
                </div>

                <div className='flex items-center justify-between'>
                    <h2 className='text-white text-lg font-semibold'>Previous Connections</h2>
                </div>
                
                <div className='flex-1 overflow-y-auto space-y-2 pr-2 previous-connections'>
                    {connectionsLoading ? (
                        <div className='text-center py-8'>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-quaternary mx-auto mb-2"></div>
                            <p className='text-gray-400 text-sm'>Loading connections...</p>
                        </div>
                    ) : previousConnections.length === 0 ? (
                        <div className='text-center py-8'>
                            <Database size={32} className='text-gray-500 mx-auto mb-2' />
                            <p className='text-gray-400 text-sm'>No previous connections</p>
                            <p className='text-gray-500 text-xs'>Your connections will appear here</p>
                        </div>
                    ) : (
                        previousConnections.map((connection) => (
                            <div 
                                key={connection._id}
                                className={`${connection.isSample 
                                    ? 'bg-brand-quaternary/20 border-brand-quaternary/30' 
                                    : 'bg-brand-tertiary border-transparent hover:border-brand-quaternary'
                                } rounded-lg p-3 cursor-pointer hover:bg-opacity-80 transition-all duration-200 border`}
                                onClick={() => loadConnection(connection)}
                            >
                                <div className='flex items-start justify-between mb-2'>
                                    <div className='flex items-center gap-2 flex-1'>
                                        <h3 className='text-white font-medium text-sm truncate'>
                                        {connection.nickname}
                                    </h3>
                                       
                                    </div>
                                    <div className='flex items-center gap-1'>
                                        {!connection.isSample && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeConnection(connection._id);
                                            }}
                                            className='text-gray-500 cursor-pointer hover:text-red-400 transition-colors p-1'
                                            title="Remove connection"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className='text-gray-400 text-xs mb-2 truncate'>
                                    {connection.isSample 
                                        ? 'Sample Database (Read Only)' 
                                        : (connection.uri ? getMaskedURI(connection.uri) : '••••••••••••••••••••••••••••••••••••••••')
                                    }
                                </div>
                                
                                <div className='flex items-center gap-1 text-gray-300'>
                                    <Clock size={10} />
                                    <span className='text-xs'>{formatDate(connection.lastUsed)}</span>
                                    {connection.isActive && (
                                        <span className='text-xs text-green-400'>• Active</span>
                                    )}
                                    {connection.isSample && (
                                        <span className='text-xs text-brand-quaternary'>• Read Only</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
        
        <div className="w-[80%] min-h-screen flex justify-center items-center flex-col gap-10 relative">
            {/* Profile Icon - Top Right Corner */}
            <div className="absolute top-6 right-6 z-10">
                {userLoading ? (
                    <div className="w-10 h-10 bg-brand-tertiary rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-brand-quaternary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : userError ? (
                    <button
                        onClick={() => navigate('/login')}
                        className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-semibold hover:bg-red-600 transition-all duration-200"
                        title="Login Required"
                    >
                        !
                    </button>
                ) : user ? (
                    <>
                        <button
                            onClick={() => setShowProfileModal(!showProfileModal)}
                            className="w-10 h-10 cursor-pointer bg-brand-tertiary rounded-full flex items-center justify-center text-white font-semibold hover:bg-opacity-80 transition-all duration-200"
                            title="Profile"
                        >
                            {getFirstLetter(user.name)}
                        </button>
                        
                        {/* Profile Modal */}
                        {showProfileModal && (
                            <>
                                {/* Backdrop */}
                                <div 
                                    className="fixed inset-0 bg-black/50 z-20"
                                    onClick={() => setShowProfileModal(false)}
                                />
                                
                                {/* Modal */}
                                <div className="absolute top-12 right-0 bg-brand-secondary rounded-lg p-4 border border-brand-tertiary shadow-lg z-30 min-w-64">
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-tertiary">
                                        <div className="w-8 h-8 bg-brand-quaternary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                            {getFirstLetter(user.name)}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-sm">{user.name}</p>
                                            <p className="text-gray-400 text-xs">{user.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowSettingsModal(true);
                                            setShowProfileModal(false);
                                        }}
                                        className="w-full flex items-center gap-2 text-gray-300 cursor-pointer transition-colors p-2 rounded-md hover:bg-brand-tertiary"
                                    >
                                        <Settings size={16} />
                                        <span className="text-sm">Settings</span>
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 text-gray-300 hover:text-red-400 cursor-pointer transition-colors p-2 rounded-md hover:bg-brand-tertiary"
                                    >
                                        <LogOut size={16} />
                                        <span className="text-sm">Logout</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <button
                        onClick={() => navigate('/login')}
                        className="w-10 h-10 bg-brand-tertiary rounded-full flex items-center justify-center text-white font-semibold hover:bg-opacity-80 transition-all duration-200"
                        title="Login"
                    >
                        ?
                    </button>
                )}
            </div>
          
            <h1 className='text-white text-4xl font-bold'>Connect to your <span className='text-brand-quaternary'>MongoDB Database</span></h1>
            
            {/* Success/Error Messages */}
            {success && (
                <div className="w-[50%] bg-brand-secondary border border-green-500/50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-green-400 text-sm">✓</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-green-200 text-sm">{success}</p>
                        </div>
                        <button
                            onClick={() => setSuccess('')}
                            className="text-xs bg-brand-tertiary text-gray-300 px-3 py-1.5 rounded-md hover:text-white hover:bg-opacity-80 transition-colors cursor-pointer"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
            
            {limitError && (
                <div className="w-[50%] bg-brand-secondary border border-brand-quaternary/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-brand-quaternary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-brand-quaternary text-sm">ℹ️</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-medium text-sm mb-2">Connection Limit Reached</h4>
                            <p className="text-gray-300 text-sm leading-relaxed mb-3">
                                You can only have up to 2 database connections. To create a new connection, please remove an existing one first, or use one of your previous connections below.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setLimitError('');
                                        // Smooth scroll to previous connections section
                                        setTimeout(() => {
                                            const connectionsSection = document.querySelector('.previous-connections');
                                            if (connectionsSection) {
                                                connectionsSection.parentElement.scrollIntoView({ 
                                                    behavior: 'smooth',
                                                    block: 'center'
                                                });
                                                // Brief highlight effect
                                                connectionsSection.parentElement.style.backgroundColor = 'rgba(60, 188, 107, 0.1)';
                                                setTimeout(() => {
                                                    connectionsSection.parentElement.style.backgroundColor = '';
                                                }, 2000);
                                            }
                                        }, 100);
                                    }}
                                    className="text-xs bg-brand-quaternary/20 text-white px-3 py-1.5 rounded-md hover:bg-brand-quaternary/30 transition-colors cursor-pointer"
                                >
                                    View Connections
                                </button>
                                <button
                                    onClick={() => setLimitError('')}
                                    className="text-xs bg-brand-tertiary text-gray-300 px-3 py-1.5 rounded-md hover:text-white hover:bg-opacity-80 transition-colors cursor-pointer"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {error && (
                <div className="w-[50%] bg-brand-secondary border border-red-500/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-red-400 text-sm">⚠</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-medium text-sm mb-1">Connection Error</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">{error}</p>
                        </div>
                        <button
                            onClick={() => setError('')}
                            className="text-xs bg-brand-tertiary text-gray-300 px-3 py-1.5 rounded-md hover:text-white hover:bg-opacity-80 transition-colors cursor-pointer"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
            
            <form className='w-[50%] bg-brand-secondary rounded-4xl flex flex-col gap-7 justify-center px-10 py-8' onSubmit={handleConnect} noValidate>
                <div className='w-full flex flex-col gap-2'>
                    <label htmlFor='nickname' className='text-gray-400 text-md font-semibold'>Nickname</label>
                    <input 
                        type='text' 
                        name='nickname' 
                        placeholder='e.g. Production Cluster' 
                        className={`placeholder-gray-500 h-12 rounded-md border-1 border-brand-tertiary p-2 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white ${nicknameError ? 'border-red-500' : ''}`}
                        id='nickname'
                        value={nickname}
                        onChange={handleInputChange}
                        required
                    />
                    {nicknameError && <span className="text-red-400 text-xs mt-1">{nicknameError}</span>}
                </div>
                <div className='w-full flex flex-col gap-2 mt-2'>
                    <div className='flex items-center gap-2'>
                        <label htmlFor='connectionURI' className='text-gray-400 text-md font-semibold'>MongoDB Connection URL</label>
                        <button
                            type="button"
                            className={`p-1 rounded-full transition-all duration-200 cursor-pointer ${
                                uriError || error ? 'text-red-400 bg-opacity-10 animate-pulse' : 'text-gray-400 hover:text-brand-quaternary'
                            }`}
                            onClick={toggleInstructions}
                            title="Connection Instructions"
                        >
                            <Info size={16} />
                        </button>
                    </div>
                    
                    <p className='text-amber-300/80 text-sm font-medium -mb-1'>
                        Note: You may need to whitelist our server's IP (
                        <span 
                            id="serverIP-inline"
                            className='cursor-pointer hover:bg-amber-700/20 px-1 rounded transition-colors duration-200'
                            onClick={() => copyToClipboard(serverIP, 'serverIP-inline')}
                            title="Click to copy"
                        >
                            {serverIP}
                        </span>
                        ) in MongoDB Atlas Network Access
                    </p>
                    
                    {showInstructions && (
                        <div className='bg-brand-tertiary rounded-lg p-4 mb-2 border border-brand-quaternary'>
                            <h4 className='text-white font-semibold mb-2'>Connection Instructions:</h4>
                            <ul className='text-gray-300 text-sm space-y-1'>
                                <li>• <strong>IP Whitelist:</strong> Add <code 
                                    id="serverIP-instructions"
                                    className='bg-gray-800 px-1 rounded text-amber-300 cursor-pointer hover:bg-gray-700 transition-colors duration-200'
                                    onClick={() => copyToClipboard(serverIP, 'serverIP-instructions')}
                                    title="Click to copy"
                                >{serverIP}</code> to MongoDB Atlas Network Access</li>
                                <li>• <strong>URI Format:</strong> mongodb+srv://username:password@cluster.mongodb.net/database</li>
                                <li>• <strong>Authentication:</strong> Ensure username/password are correct</li>
                                <li>• <strong>Database:</strong> Specify the database name at the end of the URI</li>
                                <li>• <strong>SSL:</strong> MongoDB Atlas requires SSL connections</li>
                            </ul>
                        </div>
                    )}
                    
                    <div className='relative'>
                        <input 
                            type='text' 
                            name='connectionURI' 
                            placeholder="mongodb+srv://username:password@cluster.mongodb.net/database" 
                            className={`placeholder-gray-500 h-12 rounded-md border-1 border-brand-tertiary p-2 pr-12 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white w-full ${uriError ? 'border-red-500' : ''}`}
                            id='connectionURI'
                            value={showCredentials ? connectionURI : getMaskedURI(connectionURI)}
                            onChange={handleInputChange}
                            onFocus={() => {
                                // Auto-show credentials when user tries to edit
                                if (!showCredentials) {
                                    setShowCredentials(true);
                                }
                            }}
                            required
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white focus:outline-none"
                            tabIndex={-1}
                            onClick={() => setShowCredentials(v => !v)}
                            aria-label={showCredentials ? 'Hide credentials' : 'Show credentials'}
                        >
                            {showCredentials ? (
                                <EyeOff size={16} />
                            ) : (
                                <Eye size={16} />
                            )}
                        </button>
                    </div>
                    {uriError && <span className="text-red-400 text-xs mt-1">{uriError}</span>}
                </div>
                
                <div className='w-full flex gap-4'>
                    <button 
                        type='submit' 
                        disabled={loading}
                        className={`flex-1 h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Connecting...' : 'Connect'}
                    </button>
                    
                    <button
                        type="button"
                        onClick={testConnection}
                        disabled={testingConnection}
                        className={`flex uppercase font-bold items-center justify-center gap-2 px-6 py-3 bg-[#35c56a69] text-white rounded-md hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer ${testingConnection ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title="Test Connection"
                    >
                        {testingConnection ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Testing...</span>
                            </>
                        ) : (
                            <span>Test</span>
                        )}
                    </button>
                </div>
                
                <p className='text-gray-400 text-sm text-center mt-6'>
                    Your connection details are secured and encrypted.
                </p>
            </form>
        </div>
        </div>
        
        {/* Settings Modal */}
        <SettingsModal 
            isOpen={showSettingsModal} 
            onClose={() => setShowSettingsModal(false)} 
        />
        </div>
    )
}

export default Connect