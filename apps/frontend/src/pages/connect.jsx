import {React, useEffect, useState} from 'react'
import { Eye, EyeOff, Plus, Trash2, Database, Clock } from 'lucide-react';
import Logo from '../components/Logo';

function Connect() {
    useEffect(() => {
        document.title = "MongoSnap - Connect";
    }, []);

    const [nickname, setNickname] = useState('');
    const [connectionURI, setConnectionURI] = useState('');
    const [uriError, setUriError] = useState('');
    const [nicknameError, setNicknameError] = useState('');
    const [showCredentials, setShowCredentials] = useState(false);
    
    // Previous connections state
    const [previousConnections, setPreviousConnections] = useState([
        {
            id: 1,
            nickname: 'Production Cluster',
            uri: 'mongodb+srv://admin:password123@cluster0.mongodb.net/production',
            lastUsed: '2024-01-15T10:30:00Z',
            status: 'connected'
        },
        {
            id: 2,
            nickname: 'Development DB',
            uri: 'mongodb+srv://dev:devpass@cluster1.mongodb.net/development',
            lastUsed: '2024-01-14T15:45:00Z',
            status: 'disconnected'
        },
        {
            id: 3,
            nickname: 'Staging Environment',
            uri: 'mongodb+srv://staging:stagingpass@cluster2.mongodb.net/staging',
            lastUsed: '2024-01-13T09:20:00Z',
            status: 'disconnected'
        }
    ]);

    // MongoDB URI validation regex (basic)
    const mongoUriRegex = /^mongodb(?:\+srv)?:\/\/.+:.+@.+\/.+/;

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
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInHours < 48) return 'Yesterday';
        return date.toLocaleDateString();
    };

    // Load connection into form
    const loadConnection = (connection) => {
        setNickname(connection.nickname);
        setConnectionURI(connection.uri);
        setShowCredentials(false);
        setUriError('');
        setNicknameError('');
    };

    // Remove connection
    const removeConnection = (id) => {
        setPreviousConnections(prev => prev.filter(conn => conn.id !== id));
    };

    const handleConnect = (e) => {
        e.preventDefault();
        let valid = true;
        setUriError('');
        setNicknameError('');
        if (!nickname.trim()) {
            setNicknameError('Nickname is required');
            valid = false;
        }
        if (!connectionURI.trim()) {
            setUriError('MongoDB URI is required');
            valid = false;
        } else if (!mongoUriRegex.test(connectionURI.trim())) {
            setUriError('Please enter a valid MongoDB connection URI');
            valid = false;
        }
        if (!valid) return;
        
        // Add to previous connections if not already there
        const existingConnection = previousConnections.find(conn => 
            conn.nickname === nickname.trim() || conn.uri === connectionURI.trim()
        );
        
        if (!existingConnection) {
            const newConnection = {
                id: Date.now(),
                nickname: nickname.trim(),
                uri: connectionURI.trim(),
                lastUsed: new Date().toISOString(),
                status: 'connected'
            };
            setPreviousConnections(prev => [newConnection, ...prev]);
        }
        
        // Proceed with connection logic here
        console.log('Connecting to:', { nickname: nickname.trim(), uri: connectionURI.trim() });
    };

    return (
        <div className="min-h-screen w-full flex">
        <div className="w-[20%] min-h-screen flex flex-col bg-brand-secondary">
            <div className='flex items-center mb-6 p-4 border-b border-brand-tertiary'>
                <Logo size="default" />
                <h1 className='md:text-2xl text-3xl font-bold text-white tracking-wide ml-2'>Mongo<span className='text-brand-quaternary'>Snap</span></h1>
            </div>
            
            <div className='flex flex-col gap-4 px-4 flex-1 overflow-hidden'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-white text-lg font-semibold'>Previous Connections</h2>
                </div>
                
                <div className='flex-1 overflow-y-auto space-y-2 pr-2'>
                    {previousConnections.length === 0 ? (
                        <div className='text-center py-8'>
                            <Database size={32} className='text-gray-500 mx-auto mb-2' />
                            <p className='text-gray-400 text-sm'>No previous connections</p>
                            <p className='text-gray-500 text-xs'>Your connections will appear here</p>
                        </div>
                    ) : (
                        previousConnections.map((connection) => (
                            <div 
                                key={connection.id}
                                className='bg-brand-tertiary rounded-lg p-3 cursor-pointer hover:bg-opacity-80 transition-all duration-200 border border-transparent hover:border-brand-quaternary'
                                onClick={() => loadConnection(connection)}
                            >
                                <div className='flex items-start justify-between mb-2'>
                                    <h3 className='text-white font-medium text-sm truncate flex-1'>
                                        {connection.nickname}
                                    </h3>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeConnection(connection.id);
                                        }}
                                        className='text-gray-500 hover:text-red-400 transition-colors p-1'
                                        title="Remove connection"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                
                                <div className='text-gray-400 text-xs mb-2 truncate'>
                                    {getMaskedURI(connection.uri)}
                                </div>
                                
                                <div className='flex items-center gap-1 text-gray-500'>
                                    <Clock size={10} />
                                    <span className='text-xs'>{formatDate(connection.lastUsed)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
        
        <div className="w-[80%] min-h-screen flex justify-center items-center flex-col gap-10">
            <h1 className='text-white text-4xl font-bold'>Connect to your <span className='text-brand-quaternary'>MongoDB Database</span></h1>
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
                        onChange={e => setNickname(e.target.value)}
                        required
                    />
                    {nicknameError && <span className="text-red-400 text-xs mt-1">{nicknameError}</span>}
                </div>
                <div className='w-full flex flex-col gap-2 mt-2'>
                    <label htmlFor='connectionURI' className='text-gray-400 text-md font-semibold'>MongoDB Connection URL</label>
                    <div className='relative'>
                        <input 
                            type='text' 
                            name='connectionURI' 
                            placeholder="mongodb+srv://username:password@cluster.mongodb.net/database" 
                            className={`placeholder-gray-500 h-12 rounded-md border-1 border-brand-tertiary p-2 pr-12 focus:outline-none focus:border-2 focus:border-green-700 text-md text-white w-full ${uriError ? 'border-red-500' : ''}`}
                            id='connectionURI'
                            value={showCredentials ? connectionURI : getMaskedURI(connectionURI)}
                            onChange={(e) => {
                                // Only update if we're in show mode or if the value doesn't contain masked bullets
                                if (showCredentials || !e.target.value.includes('••••••')) {
                                    setConnectionURI(e.target.value);
                                }
                            }}
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
                <button type='submit' className='w-full h-12 rounded-md bg-[#35c56a69] text-white text-md font-bold uppercase hover:bg-[#35c56a69] hover:scale-102 transition-all duration-300 cursor-pointer mt-2'>Connect</button>
                <p className='text-gray-400 text-sm text-center mt-2'>
                    Your connection details are secured and encrypted.
                </p>
            </form>
        </div>
        </div>
    )
}

export default Connect