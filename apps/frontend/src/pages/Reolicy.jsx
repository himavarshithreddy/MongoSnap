import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';
import PublicLayout from '../components/PublicLayout.jsx';

const Reolicy = () => {
    const navigate = useNavigate();
    const getActionButton = useAuthActionButton();

    useEffect(() => {
        document.title = "Refund Policy - MongoSnap";
    }, []);

    return (
        <PublicLayout>
            {/* Hero Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                            Refund <span className="text-brand-quaternary">Policy</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed mb-8">
                            We want you to be satisfied with our service. Learn about our refund and cancellation policies.
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

            {/* Refund Policy Content */}
            <section className="py-20 bg-brand-secondary/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary">
                        <div className="prose prose-invert max-w-none">
                            <h1 className="text-3xl font-bold text-white mb-4">Refund Policy</h1>
                            <p className="text-gray-300 mb-6">Last updated: July 12, 2025</p>
                            
                            <p className="text-gray-300 mb-6">
                                Thank you for subscribing to MongoSnap's services. We hope you are satisfied with our services, but if not, we're here to help.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Cancellation Policy</h2>
                            <p className="text-gray-300 mb-6">
                                Subscribers may cancel their recurring subscription at any time. Upon cancellation, your account will remain active until the end of your current billing cycle.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Refund Eligibility</h2>
                            <p className="text-gray-300 mb-4">
                                To be eligible for a refund, you must submit a request within 3 days of your subscription start date. Refunds may be considered on a case-by-case basis and are granted at the sole discretion of MongoSnap.
                            </p>
                            <p className="text-gray-300 mb-4">
                                Refund requests can be made if you encounter technical issues that prevent you from using our service and that cannot be resolved by our support team. Proof of the issue may be required.
                            </p>
                            <p className="text-gray-300 mb-6">
                                Please note that refunds are not guaranteed and may vary depending on the circumstances. Refund requests due to issues beyond MongoSnap's control (e.g., changes in personal circumstances, third-party hardware or software failures, etc.) will not be honored.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Process for Requesting a Refund</h2>
                            <p className="text-gray-300 mb-6">
                                To request a refund, please contact our customer support team at <a href="mailto:support@mongosnap.live" className="text-brand-quaternary hover:text-white transition-colors">support@mongosnap.live</a>. Include your account information, subscription details, and a brief explanation of why you are requesting a refund.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Refund Processing</h2>
                            <p className="text-gray-300 mb-6">
                                Once your refund request is received and inspected, we will send you an email to notify you of the approval or rejection of your refund. If approved, your refund will be processed, and a credit will automatically be applied to your original method of payment within a certain number of days. Please note that refunds can only be made back to the original payment method used at the time of purchase.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Changes to Refund Policy</h2>
                            <p className="text-gray-300 mb-6">
                                MongoSnap reserves the right to modify this refund policy at any time. Changes will take effect immediately upon their posting on the website. By continuing to use our services after changes are made, you agree to be bound by the revised policy.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Contact Us</h2>
                            <p className="text-gray-300 mb-8">
                                If you have any questions about our refund policy, please contact us at <a href="mailto:support@mongosnap.live" className="text-brand-quaternary hover:text-white transition-colors">support@mongosnap.live</a>.
                            </p>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Scenarios Where Refunds Would Typically Be Granted:</h2>
                            <div className="bg-brand-tertiary/30 rounded-lg p-6 mb-6">
                                <h3 className="text-lg font-semibold text-white mb-3">1. Technical Issues</h3>
                                <p className="text-gray-300 mb-4">
                                    The customer experiences persistent technical issues that prevent them from using the SaaS product effectively, despite multiple attempts by the support team to resolve the problem. For example, the software fails to load or crashes frequently, impeding the customer's ability to perform necessary tasks.
                                </p>
                                
                                <h3 className="text-lg font-semibold text-white mb-3">2. Misrepresentation of Features</h3>
                                <p className="text-gray-300">
                                    The features or capabilities of the SaaS product were misrepresented on the website or during the sales process, and the product does not perform as advertised. For example, if the product was sold with the promise of specific functionalities that are not actually available.
                                </p>
                            </div>

                            <h2 className="text-2xl font-bold text-white mt-8 mb-4">Scenarios Where Refunds Would Not Typically Be Granted:</h2>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-white mb-3">1. Change of Mind</h3>
                                <p className="text-gray-300 mb-4">
                                    The customer decides they no longer want or need the SaaS product after the refund eligibility period has passed. For example, they found a different product they prefer, or they no longer need the service due to changes in their business.
                                </p>
                                
                                <h3 className="text-lg font-semibold text-white mb-3">2. Failure to Cancel</h3>
                                <p className="text-gray-300 mb-4">
                                    The customer forgot to cancel their subscription before the renewal date and was charged for another cycle. It is the customer's responsibility to manage their subscription and cancel it before the billing cycle if they do not wish to continue.
                                </p>
                                
                                <h3 className="text-lg font-semibold text-white mb-3">3. External Factors</h3>
                                <p className="text-gray-300">
                                    The customer is unable to use the SaaS product due to factors outside of MongoSnap's control, such as incompatible hardware, poor internet connection, or issues with third-party software or services.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="bg-gradient-to-r from-brand-quaternary/20 to-blue-500/20 rounded-2xl p-12 border border-brand-quaternary/30">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Need Help with a Refund?
                        </h2>
                        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                            Our support team is here to help you with any refund requests or questions.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => navigate('/contact')}
                                className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                Contact Support
                            </button>
                            
                            {getActionButton()}
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default Reolicy; 