import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Star, Zap, Database, Shield, Users, Clock, Globe, Download, Upload, Monitor, Smartphone, Server, BarChart3, Key, Mail, QrCode } from 'lucide-react';
import Logo from '../components/Logo';

const Pricing = () => {
    const navigate = useNavigate();

    const features = {
        free: [
            { name: 'Natural Language Queries', description: 'Ask questions in plain English', icon: Zap },
            { name: 'MongoDB Query Generation', description: 'Generate MongoDB queries from natural language', icon: Database },
            { name: 'Schema Explorer', description: 'Browse and understand your database structure', icon: Monitor },
            { name: 'Query History', description: 'View your last 50 queries', icon: Clock },
            { name: 'Basic Security', description: 'JWT authentication with refresh tokens', icon: Shield },
            { name: 'Session Management', description: 'Manage active sessions across devices', icon: Users },
            { name: 'Two-Factor Authentication', description: 'Email OTP and TOTP support', icon: Key },
            { name: 'Login Notifications', description: 'Email alerts for new logins', icon: Mail },
            { name: 'Database Export', description: 'Export collections as ZIP (limited)', icon: Download },
            { name: 'Sample Database', description: 'Try features with demo database', icon: Database },
        ],
        pro: [
            { name: 'Everything in Free', description: 'All free features included', icon: Check },
            { name: 'Unlimited Queries', description: 'No daily/monthly limits', icon: Zap },
            { name: 'Advanced AI Generation', description: 'Complex query generation with context', icon: Database },
            { name: 'Unlimited Query History', description: 'Store and search all your queries', icon: Clock },
            { name: 'Saved Queries', description: 'Save and organize your favorite queries', icon: Star },
            { name: 'Advanced Security', description: 'CSRF protection, token rotation, threat detection', icon: Shield },
            { name: 'Session Analytics', description: 'Detailed session insights and security monitoring', icon: BarChart3 },
            { name: 'Unlimited Database Export', description: 'Export full databases without limits', icon: Download },
            { name: 'Multiple Connections', description: 'Connect to unlimited databases', icon: Server },
            { name: 'Advanced Schema Analysis', description: 'Deep insights into data patterns', icon: BarChart3 },
            { name: 'Team Collaboration', description: 'Share queries and insights with team', icon: Users },
            { name: 'Priority Support', description: '24/7 email and chat support', icon: Globe },
            { name: 'API Access', description: 'REST API for integrations', icon: Key },
        ]
    };

    const limits = {
        free: {
            queries: '100 queries/day',
            aiGeneration: '10 generations/day',
            connections: '2 databases',
            exports: '2 exports/hour',
            history: '50 queries',
            sessions: '5 active sessions'
        },
        pro: {
            queries: 'Unlimited',
            aiGeneration: 'Unlimited',
            connections: 'Unlimited',
            exports: 'Unlimited',
            history: 'Unlimited',
            sessions: 'Unlimited'
        }
    };

    return (
        <div className="min-h-screen bg-[#101813]">
            {/* Header */}
            <div className="bg-[#17211b] border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div className="flex items-center gap-3">
                            <Logo size="default" />
                            <h1 className="text-2xl font-bold text-white">MongoSnap</h1>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => navigate('/playground')}
                                className="px-4 py-2 bg-[#35c56a69] text-white rounded-lg hover:bg-[#35c56a] transition-colors"
                            >
                                Try Free
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hero Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Choose Your Plan
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Start with our powerful free tier or unlock unlimited potential with Pro. 
                        Both plans include enterprise-grade security and AI-powered MongoDB query generation.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* Free Tier */}
                    <div className="bg-[#17211b] rounded-2xl p-8 border border-gray-800 relative">
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
                            <div className="text-4xl font-bold text-white mb-2">$0</div>
                            <p className="text-gray-400">Perfect for getting started</p>
                        </div>

                        {/* Usage Limits */}
                        <div className="mb-8">
                            <h4 className="text-lg font-semibold text-white mb-4">Usage Limits</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Queries per day</span>
                                    <span className="text-white font-medium">{limits.free.queries}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">AI Generations</span>
                                    <span className="text-white font-medium">{limits.free.aiGeneration}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Database Connections</span>
                                    <span className="text-white font-medium">{limits.free.connections}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Exports per hour</span>
                                    <span className="text-white font-medium">{limits.free.exports}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Query History</span>
                                    <span className="text-white font-medium">{limits.free.history}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Active Sessions</span>
                                    <span className="text-white font-medium">{limits.free.sessions}</span>
                                </div>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="mb-8">
                            <h4 className="text-lg font-semibold text-white mb-4">Features</h4>
                            <div className="space-y-3">
                                {features.free.map((feature, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className="p-1 bg-[#35c56a69] rounded-lg mt-0.5">
                                            <feature.icon size={14} className="text-[#11a15e]" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm">{feature.name}</div>
                                            <div className="text-gray-400 text-xs">{feature.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/playground')}
                            className="w-full py-3 bg-[#35c56a69] text-white rounded-lg hover:bg-[#35c56a] transition-colors font-medium"
                        >
                            Get Started Free
                        </button>
                    </div>

                    {/* Pro Tier */}
                    <div className="bg-gradient-to-br from-[#17211b] to-[#1a2520] rounded-2xl p-8 border-2 border-[#11a15e] relative">
                        {/* Popular Badge */}
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                            <div className="bg-[#11a15e] text-white px-4 py-1 rounded-full text-sm font-medium">
                                Most Popular
                            </div>
                        </div>

                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                            <div className="text-4xl font-bold text-white mb-2">$29</div>
                            <p className="text-gray-400">per month</p>
                        </div>

                        {/* Usage Limits */}
                        <div className="mb-8">
                            <h4 className="text-lg font-semibold text-white mb-4">Usage Limits</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Queries per day</span>
                                    <span className="text-[#11a15e] font-medium">{limits.pro.queries}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">AI Generations</span>
                                    <span className="text-[#11a15e] font-medium">{limits.pro.aiGeneration}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Database Connections</span>
                                    <span className="text-[#11a15e] font-medium">{limits.pro.connections}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Exports per hour</span>
                                    <span className="text-[#11a15e] font-medium">{limits.pro.exports}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Query History</span>
                                    <span className="text-[#11a15e] font-medium">{limits.pro.history}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Active Sessions</span>
                                    <span className="text-[#11a15e] font-medium">{limits.pro.sessions}</span>
                                </div>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="mb-8">
                            <h4 className="text-lg font-semibold text-white mb-4">Features</h4>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {features.pro.map((feature, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className="p-1 bg-[#35c56a69] rounded-lg mt-0.5">
                                            <feature.icon size={14} className="text-[#11a15e]" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm">{feature.name}</div>
                                            <div className="text-gray-400 text-xs">{feature.description}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/playground')}
                            className="w-full py-3 bg-[#11a15e] text-white rounded-lg hover:bg-[#0d8a4a] transition-colors font-medium"
                        >
                            Start Pro Trial
                        </button>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-16">
                    <h3 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h3>
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        <div className="bg-[#17211b] rounded-lg p-6 border border-gray-800">
                            <h4 className="text-lg font-semibold text-white mb-2">Can I upgrade anytime?</h4>
                            <p className="text-gray-400 text-sm">
                                Yes, you can upgrade from Free to Pro at any time. Your data and settings will be preserved.
                            </p>
                        </div>
                        <div className="bg-[#17211b] rounded-lg p-6 border border-gray-800">
                            <h4 className="text-lg font-semibold text-white mb-2">Is my data secure?</h4>
                            <p className="text-gray-400 text-sm">
                                Absolutely. We use enterprise-grade security with JWT tokens, CSRF protection, and 2FA support.
                            </p>
                        </div>
                        <div className="bg-[#17211b] rounded-lg p-6 border border-gray-800">
                            <h4 className="text-lg font-semibold text-white mb-2">What databases are supported?</h4>
                            <p className="text-gray-400 text-sm">
                                We support all MongoDB versions including MongoDB Atlas, self-hosted, and local instances.
                            </p>
                        </div>
                        <div className="bg-[#17211b] rounded-lg p-6 border border-gray-800">
                            <h4 className="text-lg font-semibold text-white mb-2">Can I cancel anytime?</h4>
                            <p className="text-gray-400 text-sm">
                                Yes, you can cancel your Pro subscription anytime. You'll keep access until the end of your billing period.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Pricing; 