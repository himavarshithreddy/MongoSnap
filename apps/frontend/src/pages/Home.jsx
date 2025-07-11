import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { 
    Database, 
    Settings, 
    BarChart3, 
    Clock, 
    User,
    LogOut,
    ArrowRight,
    Star,
    Shield,
    Zap,
    Plus
} from 'lucide-react';
import Logo from '../components/Logo';

function Home() {
    useEffect(() => {
        document.title = "MongoSnap - Dashboard";
    }, []);

    const navigate = useNavigate();
    const { user, loading, error, logout } = useUser();

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-primary flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-quaternary mx-auto mb-4"></div>
                    <p className="text-lg text-white">Loading user info...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-brand-primary flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary">
                        <div className="text-red-400 text-lg mb-4">Error Loading User</div>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={logout}
                                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                            >
                                Logout
                            </button>
                            <button 
                                onClick={() => window.location.reload()}
                                className="flex-1 bg-brand-quaternary text-white px-4 py-2 rounded-lg hover:bg-brand-quaternary/90 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-brand-primary flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary">
                        <div className="text-gray-300 text-lg mb-4">No user info found</div>
                        <button 
                            onClick={logout}
                            className="w-full bg-brand-quaternary text-white px-4 py-2 rounded-lg hover:bg-brand-quaternary/90 transition-colors"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const quickActions = [
        {
            icon: Database,
            title: "Connect Database",
            description: "Connect to your MongoDB instance",
            action: () => navigate('/connect'),
            color: "bg-blue-500/20 text-blue-400",
            borderColor: "border-blue-500/50"
        },
        {
            icon: Zap,
            title: "Query Playground",
            description: "Generate queries with AI",
            action: () => navigate('/playground'),
            color: "bg-brand-quaternary/20 text-brand-quaternary",
            borderColor: "border-brand-quaternary/50"
        },
        {
            icon: Settings,
            title: "Account Settings",
            description: "Manage your account preferences",
            action: () => navigate('/settings'),
            color: "bg-purple-500/20 text-purple-400",
            borderColor: "border-purple-500/50"
        },
        {
            icon: BarChart3,
            title: "View Pricing",
            description: "Explore plans and features",
            action: () => navigate('/pricing'),
            color: "bg-orange-500/20 text-orange-400",
            borderColor: "border-orange-500/50"
        }
    ];

    const userStats = [
        { label: "Account Type", value: user.isVerified ? "Verified" : "Pending", icon: Shield },
        { label: "Member Since", value: new Date(user.createdAt).toLocaleDateString(), icon: Clock },
        { label: "Provider", value: user.oauthProvider || "Email", icon: User }
    ];

    return (
        <div className="min-h-screen bg-brand-primary">
            {/* Header */}
            <div className="bg-brand-secondary border-b border-brand-tertiary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div className="flex items-center gap-3">
                            <Logo size="default" />
                            <h1 className="text-2xl font-bold text-white tracking-wide">
                                Mongo<span className="text-brand-quaternary">Snap</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => navigate('/settings')}
                                className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-brand-tertiary"
                                title="Settings"
                            >
                                <Settings size={20} />
                            </button>
                            <button 
                                onClick={logout}
                                className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-brand-tertiary"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                        Welcome back, {user.name}! 👋
                    </h2>
                    <p className="text-xl text-gray-300">
                        Ready to generate some MongoDB queries? Let's get started.
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="mb-12">
                    <h3 className="text-2xl font-bold text-white mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {quickActions.map((action, index) => (
                            <button
                                key={index}
                                onClick={action.action}
                                className="group bg-brand-secondary rounded-xl p-6 border border-brand-tertiary hover:border-brand-quaternary/50 transition-all duration-300 text-left"
                            >
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${action.color} border ${action.borderColor}`}>
                                    <action.icon size={24} />
                                </div>
                                <h4 className="text-xl font-semibold text-white mb-2 group-hover:text-brand-quaternary transition-colors">
                                    {action.title}
                                </h4>
                                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                                    {action.description}
                                </p>
                                <div className="flex items-center gap-2 text-brand-quaternary text-sm font-medium">
                                    Get Started
                                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* User Info & Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Account Information */}
                    <div className="lg:col-span-2">
                        <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <User className="text-brand-quaternary" size={20} />
                                Account Information
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-3 border-b border-brand-tertiary">
                                    <span className="text-gray-400">Email Address</span>
                                    <span className="text-white font-medium">{user.email}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-brand-tertiary">
                                    <span className="text-gray-400">User ID</span>
                                    <span className="text-white font-mono text-sm">{user._id}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-brand-tertiary">
                                    <span className="text-gray-400">Account Status</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                        user.isVerified 
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                    }`}>
                                        {user.isVerified ? 'Verified' : 'Pending Verification'}
                                    </span>
                                </div>
                                {user.oauthProvider && (
                                    <div className="flex justify-between items-center py-3">
                                        <span className="text-gray-400">OAuth Provider</span>
                                        <span className="text-brand-quaternary font-medium capitalize">{user.oauthProvider}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Account Stats */}
                    <div className="space-y-6">
                        <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart3 className="text-brand-quaternary" size={20} />
                                Account Stats
                            </h3>
                            <div className="space-y-4">
                                {userStats.map((stat, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand-quaternary/20 rounded-lg flex items-center justify-center">
                                            <stat.icon className="text-brand-quaternary" size={16} />
                                        </div>
                                        <div>
                                            <div className="text-gray-400 text-sm">{stat.label}</div>
                                            <div className="text-white font-medium">{stat.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick Connect */}
                        <div className="bg-gradient-to-r from-brand-quaternary/20 to-blue-500/20 rounded-xl p-6 border border-brand-quaternary/30">
                            <h4 className="text-white font-bold mb-2">Ready to query?</h4>
                            <p className="text-gray-300 text-sm mb-4">
                                Connect your database and start generating queries with AI.
                            </p>
                            <button
                                onClick={() => navigate('/connect')}
                                className="w-full px-4 py-2 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-medium flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                Connect Database
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;