import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
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
            'MongoDB Query Generation',
            'Schema Explorer',
            'Query History (50 queries)',
            '2 Database Connections',
            '20 Executions/day (400/month)',
            '5 AI Generations/day (100/month)',
            'PC Version',
            'Sample Database Access',
        ],
        pro: [
            'Everything in Snap Plan',
            'Unlimited Query History',
            'Save & Organize Queries',
            'Unlimited Database Connections',
            'Unlimited Executions',
            '100 AI Generations/day (2,500/month)',
            'Enhanced AI Generation',
            'Export Database Schemas',
            'Upload Your Database',
            'Priority Support',
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
                    <div className="grid md:grid-cols-2 gap-20 max-w-5xl mx-auto">
                        {/* Free Tier */}
                        <div className="bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary relative hover:border-brand-quaternary/50 transition-all duration-300 group cursor-pointer">
                            <div className="text-center mb-10">
                                <h3 className="text-3xl font-bold text-white mb-3">Snap</h3>
                                <div className="text-5xl font-bold text-white mb-3">₹0</div>
                                <p className="text-gray-400 text-lg">Perfect for getting started</p>
                            </div>

                            {/* Features */}
                            <div className="mb-10">
                                <div className="space-y-5">
                                    {features.free.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-4">
                                            <div className="w-2 h-2 bg-brand-quaternary rounded-full flex-shrink-0"></div>
                                            <span className="text-white font-medium text-lg leading-relaxed">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/playground')}
                                className="w-full py-4 bg-brand-quaternary/20 text-brand-quaternary rounded-xl hover:bg-brand-quaternary hover:text-white transition-all duration-300 font-semibold text-lg group-hover:scale-105 cursor-pointer"
                            >
                                Get Started Free
                            </button>
                        </div>

                        {/* Pro Tier */}
                        <div className="bg-gradient-to-br from-brand-secondary to-brand-tertiary/20 rounded-2xl p-8 border-2 border-brand-quaternary relative hover:border-brand-quaternary/80 transition-all duration-300 group cursor-pointer">
                            {/* Popular Badge */}
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                <div className="bg-brand-quaternary text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                                    Recommended
                                </div>
                            </div>

                            <div className="text-center mb-10">
                                <h3 className="text-3xl font-bold text-white mb-3">SnapX</h3>
                                <div className="text-5xl font-bold text-white mb-3">₹359</div>
                                <p className="text-gray-400 text-lg">per month</p>
                            </div>

                            {/* Features */}
                            <div className="mb-10">
                                <div className="space-y-5">
                                    {features.pro.map((feature, index) => (
                                        <div key={index} className="flex items-center gap-4">
                                            <div className="w-2 h-2 bg-brand-quaternary rounded-full flex-shrink-0"></div>
                                            <span className="text-white font-medium text-lg leading-relaxed">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/playground')}
                                className="w-full py-4 bg-brand-quaternary text-white rounded-xl hover:bg-brand-quaternary/90 transition-all duration-300 font-semibold text-lg group-hover:scale-105 shadow-lg cursor-pointer"
                            >
                                Upgrade to SnapX
                            </button>
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