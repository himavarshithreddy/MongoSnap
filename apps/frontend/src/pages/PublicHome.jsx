import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Database, 
    Zap, 
    Shield, 
    Users, 
    ArrowRight, 
    CheckCircle, 
    Brain, 
    Code2, 
    Search,
    BarChart3,
    Clock,
    Globe,
    Star
} from 'lucide-react';
import { useUser } from '../hooks/useUser';
import PublicLayout from '../components/PublicLayout';

const PublicHome = () => {
    const navigate = useNavigate();
    const { user, loading } = useUser();

    useEffect(() => {
        document.title = "MongoSnap - AI-Powered MongoDB Query Generator";
    }, []);

    const features = [
        {
            icon: Brain,
            title: "AI-Powered Queries",
            description: "Ask questions in plain English and get optimized MongoDB queries instantly."
        },
        {
            icon: Database,
            title: "Schema Explorer",
            description: "Visualize and understand your database structure with our interactive explorer."
        },
        {
            icon: Code2,
            title: "Query Generation",
            description: "Generate complex aggregation pipelines and queries with natural language."
        },
        {
            icon: Shield,
            title: "Secure & Private",
            description: "Enterprise-grade security with encrypted connections and data protection."
        },
        {
            icon: Clock,
            title: "Query History",
            description: "Track and reuse your previous queries with our comprehensive history system."
        },
        {
            icon: BarChart3,
            title: "Query Execution",
            description: "Execute and monitor your queries with real-time results and error handling."
        }
    ];

    // Dynamic button based on authentication status
    const getActionButton = () => {
        if (loading) {
            return (
                <button className="px-8 py-4 bg-brand-quaternary/50 text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-3 cursor-not-allowed">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Loading...
                </button>
            );
        }

        if (user) {
            return (
                <button
                    onClick={() => navigate('/connect')}
                    className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 group cursor-pointer"
                >
                    Go to Dashboard
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
            );
        }

        return (
            <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 group cursor-pointer"
            >
                Get Started
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
        );
    };

    return (
        <PublicLayout>
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                    <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
                        <div className="lg:col-span-6">
                            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                                AI-Powered{' '}
                                <span className="text-brand-quaternary">MongoDB</span>{' '}
                                Query Generator
                            </h1>
                            
                            <p className="mt-6 text-xl text-gray-300 leading-relaxed">
                                Transform natural language into optimized MongoDB queries instantly. 
                                No more complex syntax - just ask what you need in plain English.
                            </p>

                            <div className="mt-8">
                                {getActionButton()}
                            </div>

                            <div className="mt-8 flex items-center gap-6 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-brand-quaternary" />
                                    <span>Easy setup</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-brand-quaternary" />
                                    <span>Secure connections</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-brand-quaternary" />
                                    <span>AI-powered</span>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-6 mt-12 lg:mt-0">
                            <div className="relative">
                                <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary shadow-2xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span className="ml-4 text-gray-400 text-sm">MongoSnap Query Interface</span>
                                    </div>
                                    
                                    <div className="bg-brand-primary rounded-lg p-4 mb-4">
                                        <p className="text-gray-300 text-sm mb-2">💬 Natural Language Input:</p>
                                        <p className="text-white">Find all users who registered in the last 30 days and have made more than 5 orders</p>
                                    </div>
                                    
                                    <div className="bg-brand-tertiary rounded-lg p-4">
                                        <p className="text-gray-300 text-sm mb-2">⚡ Generated MongoDB Query:</p>
                                        <code className="text-brand-quaternary text-sm block font-mono">
                                            {`db.users.aggregate([
  { $match: { 
    createdAt: { $gte: new Date(Date.now() - 30*24*60*60*1000) }
  }},
  { $lookup: { from: "orders", localField: "_id", foreignField: "userId", as: "orders" }},
  { $match: { "orders.4": { $exists: true } }}
])`}
                                        </code>
                                    </div>
                                </div>
                                
                                {/* Floating elements */}
                                <div className="absolute -top-4 -right-4 bg-brand-quaternary/20 backdrop-blur-sm rounded-lg p-3 border border-brand-quaternary/50">
                                    <Brain className="text-brand-quaternary" size={24} />
                                </div>
                                
                                <div className="absolute -bottom-4 -left-4 bg-brand-quaternary/20 backdrop-blur-sm rounded-lg p-3 border border-brand-quaternary/50">
                                    <Database className="text-brand-quaternary" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Powerful Features for Modern Developers
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            Everything you need to work efficiently with MongoDB, powered by cutting-edge AI technology.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div 
                                key={index} 
                                className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary hover:border-brand-quaternary/50 transition-all duration-300 group"
                            >
                                <div className="w-12 h-12 bg-brand-quaternary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-brand-quaternary/30 transition-colors">
                                    <feature.icon className="text-brand-quaternary" size={24} />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="bg-gradient-to-r from-brand-quaternary/20 to-blue-500/20 rounded-2xl p-12 border border-brand-quaternary/30">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Ready to Transform Your MongoDB Workflow?
                        </h2>
                        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                            Start building better applications faster with AI-powered MongoDB query generation.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            {getActionButton()}
                            
                            <button
                                onClick={() => navigate('/contact')}
                                className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                Contact Us
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default PublicHome; 