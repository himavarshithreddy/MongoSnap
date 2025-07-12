import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';
import PublicLayout from '../components/PublicLayout.jsx';
import PrivacyPolicyRenderer from '../components/PrivacyPolicyRenderer.jsx';
import { privacyPolicyContent } from '../data/privacyPolicyContent.js';

const Prolicy = () => {
    const navigate = useNavigate();
    const getActionButton = useAuthActionButton();

    useEffect(() => {
        document.title = "Privacy Policy - MongoSnap";
    }, []);

    return (
        <PublicLayout>
            {/* Hero Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                            Privacy <span className="text-brand-quaternary">Policy</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed mb-8">
                            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
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

            {/* Privacy Policy Content */}
            <section className="py-20 bg-brand-secondary/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary">
                        <PrivacyPolicyRenderer content={privacyPolicyContent} />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="bg-gradient-to-r from-brand-quaternary/20 to-blue-500/20 rounded-2xl p-12 border border-brand-quaternary/30">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Have Questions About Privacy?
                        </h2>
                        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                            We're committed to protecting your privacy. Contact us if you have any questions.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => navigate('/contact')}
                                className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                Contact Us
                            </button>
                            
                            {getActionButton()}
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default Prolicy; 