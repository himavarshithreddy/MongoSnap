import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Database, Shield, Users, Clock, Globe, Download, Server, BarChart3, Key, Mail } from 'lucide-react';
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';
import PublicLayout from '../components/PublicLayout';

const Pricing = () => {
    const navigate = useNavigate();
    const getActionButton = useAuthActionButton();

    useEffect(() => {
        document.title = "Pricing - MongoSnap";
    }, []);

    const features = {
        free: [
            { name: 'Natural Language Queries', icon: Zap },
            { name: 'MongoDB Query Generation', icon: Database },
            { name: 'Schema Explorer', icon: Database },
            { name: 'Query History (50 queries)', icon: Clock },
            { name: 'Basic Security & 2FA', icon: Shield },
            { name: 'Sample Database', icon: Database },
        ],
        pro: [
            { name: 'Everything in Free', icon: Check },
            { name: 'Unlimited Queries', icon: Zap },
            { name: 'Advanced AI Generation', icon: Database },
            { name: 'Unlimited Query History', icon: Clock },
            { name: 'Saved Queries', icon: Check },
            { name: 'Multiple Database Connections', icon: Server },
            { name: 'Unlimited Exports', icon: Download },
            { name: 'Priority Support', icon: Globe },
        ]
    };

    return (
        <PublicLayout>
            {/* Hero Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                            <span className="text-brand-quaternary">Pricing</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed mb-8">
                            Start free and upgrade when you need more power. 
                            No hidden fees, no surprises.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            {getActionButton()}
                            <button
                                onClick={() => document.getElementById('pricing-cards').scrollIntoView({ behavior: 'smooth' })}
                                className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                View Plans
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pricing Cards Section */}
            <section id="pricing-cards" className="py-20 bg-brand-secondary/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Free Tier */}
                        <div className="bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary relative hover:border-brand-quaternary/50 transition-all duration-300">
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-bold text-white mb-2">Snap</h3>
                                <div className="text-4xl font-bold text-white mb-2">$0</div>
                                <p className="text-gray-400">Perfect for getting started</p>
                            </div>

                            {/* Features */}
                            <div className="mb-8">
                                <div className="space-y-4">
                                    {features.free.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            <div className="p-1 bg-brand-quaternary/20 rounded-lg">
                                                <feature.icon size={16} className="text-brand-quaternary" />
                                            </div>
                                            <span className="text-white font-medium">{feature.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/playground')}
                                className="w-full py-3 bg-brand-quaternary/20 text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-medium"
                            >
                                Get Started Free
                            </button>
                        </div>

                        {/* Pro Tier */}
                        <div className="bg-gradient-to-br from-brand-secondary to-brand-tertiary/20 rounded-2xl p-8 border-2 border-brand-quaternary relative hover:border-brand-quaternary/80 transition-all duration-300">
                            {/* Popular Badge */}
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                <div className="bg-brand-quaternary text-white px-4 py-1 rounded-full text-sm font-medium">
                                    Most Popular
                                </div>
                            </div>

                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-bold text-white mb-2">SnapX</h3>
                                <div className="text-4xl font-bold text-white mb-2">$29</div>
                                <p className="text-gray-400">per month</p>
                            </div>

                            {/* Features */}
                            <div className="mb-8">
                                <div className="space-y-4">
                                    {features.pro.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-3">
                                            <div className="p-1 bg-brand-quaternary/20 rounded-lg">
                                                <feature.icon size={16} className="text-brand-quaternary" />
                                            </div>
                                            <span className="text-white font-medium">{feature.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/playground')}
                                className="w-full py-3 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-medium"
                            >
                                Start Pro Trial
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Simple FAQ Section */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Questions?
                        </h2>
                        <p className="text-xl text-gray-300">
                            We're here to help
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary">
                            <h4 className="text-lg font-semibold text-white mb-2">Can I upgrade anytime?</h4>
                            <p className="text-gray-400">
                                Yes, upgrade from Free to Pro whenever you need more features.
                            </p>
                        </div>
                        <div className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary">
                            <h4 className="text-lg font-semibold text-white mb-2">Is my data secure?</h4>
                            <p className="text-gray-400">
                                Absolutely. Enterprise-grade security with JWT tokens and 2FA support.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="bg-gradient-to-r from-brand-quaternary/20 to-blue-500/20 rounded-2xl p-12 border border-brand-quaternary/30">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Ready to Get Started?
                        </h2>
                        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                            Start building better MongoDB queries today.
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

export default Pricing; 