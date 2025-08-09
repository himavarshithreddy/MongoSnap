import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';
import PublicLayout from '../components/PublicLayout';
import { useUser } from '../hooks/useUser';
import { useSubscription } from '../hooks/useUser';
import { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';
import { useState } from 'react';
import ErrorNotification from '../components/ErrorNotification';
import PayUPayment from '../components/PayUPayment';

const Pricing = () => {
    const navigate = useNavigate();
    const getActionButton = useAuthActionButton();
    const { user } = useUser();
    const { fetchWithAuth, refreshUser } = useContext(UserContext);
    const subscription = useSubscription();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [isProcessingCancel, setIsProcessingCancel] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [cancelError, setCancelError] = useState('');

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

    const handleUpgradeClick = () => {
        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = async (paymentData) => {
        console.log('Payment successful:', paymentData);
        setShowPaymentModal(false);
        setPaymentSuccess(true);
        // Refresh user data to get updated subscription status
        await refreshUser();
        // Auto-hide success message after 5 seconds
        setTimeout(() => setPaymentSuccess(false), 5000);
    };

    const handlePaymentFailure = (errorData) => {
        console.log('Payment failed:', errorData);
        setShowPaymentModal(false);
        setPaymentError('Payment failed. Please try again or contact support.');
        
        // Auto-hide error message after 10 seconds
        setTimeout(() => setPaymentError(''), 10000);
    };

    const handleCancelSubscription = async () => {
        try {
            setIsProcessingCancel(true);
            
            const response = await fetchWithAuth('/api/auth/cancel-subscription', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                await response.json();
                setShowCancelModal(false);
                setPaymentSuccess(true);
                
                // Refresh user data from backend to get updated subscription info
                await refreshUser();
                
                setTimeout(() => setPaymentSuccess(false), 3000);
            } else {
                const errorData = await response.json();
                console.error('Failed to cancel subscription:', errorData);
                setCancelError('Failed to cancel subscription. Please try again.');
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            setCancelError('Failed to cancel subscription. Please try again.');
        } finally {
            setIsProcessingCancel(false);
        }
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
                        {user ? (
                            <>
                                <p className="text-xl text-gray-300 leading-relaxed mb-8">
                                    {subscription.isSnapXUser 
                                        ? `You're currently on the ${subscription.planName} plan. Manage your subscription below.`
                                        : `You're currently on the ${subscription.planName} plan. Upgrade to unlock premium features.`
                                    }
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <button
                                        onClick={() => navigate('/connect')}
                                        className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg cursor-pointer"
                                    >
                                        Go to Dashboard
                                    </button>
                                    <button
                                        onClick={() => document.getElementById('pricing-cards').scrollIntoView({ behavior: 'smooth' })}
                                        className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                                    >
                                        Manage Subscription
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Pricing Cards Section */}
            <section id="pricing-cards" className="py-20 bg-brand-secondary/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    <div className="grid md:grid-cols-2 gap-20 max-w-5xl mx-auto">
                        {/* Free Tier */}
                        <div className={`bg-brand-secondary rounded-2xl p-8 border relative transition-all duration-300 group cursor-pointer ${
                            user && subscription.isSnapUser ? 'border-brand-quaternary' : 'border-brand-tertiary hover:border-brand-quaternary/50'
                        }`}>
                            {user && subscription.isSnapUser && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                    <div className="bg-green-600 text-white px-6 py-2 rounded-full text-sm font-semibold shadow-lg">
                                        Current Plan
                                    </div>
                                </div>
                            )}
                            
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
                                onClick={() => navigate('/connect')}
                                className="w-full py-4 bg-brand-quaternary/20 text-brand-quaternary rounded-xl hover:bg-brand-quaternary hover:text-white transition-all duration-300 font-semibold text-lg group-hover:scale-105 cursor-pointer"
                            >
                                {user && subscription.isSnapUser ? 'Current Plan' : 'Get Started Free'}
                            </button>
                        </div>

                        {/* Pro Tier */}
                        <div className={`bg-gradient-to-br from-brand-secondary to-brand-tertiary/20 rounded-2xl p-8 border-2 relative transition-all duration-300 group cursor-pointer ${
                            user && subscription.isSnapXUser ? 'border-green-500' : 'border-brand-quaternary hover:border-brand-quaternary/80'
                        }`}>
                            {/* Badge */}
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                <div className={`px-6 py-2 rounded-full text-sm font-semibold shadow-lg ${
                                    user && subscription.isSnapXUser ? 'bg-green-600 text-white' : 'bg-brand-quaternary text-white'
                                }`}>
                                    {user && subscription.isSnapXUser ? 'Current Plan' : 'Recommended'}
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
                                onClick={user && subscription.isSnapUser ? handleUpgradeClick : () => navigate('/settings')}
                                className="w-full py-4 bg-brand-quaternary text-white rounded-xl hover:bg-brand-quaternary/90 transition-all duration-300 font-semibold text-lg group-hover:scale-105 shadow-lg cursor-pointer"
                            >
                                {user && subscription.isSnapUser ? 'Upgrade to SnapX' : (user && subscription.isSnapXUser ? 'Current Plan' : 'Get Started')}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* PayU Payment Modal */}
            <PayUPayment
                subscriptionPlan="snapx"
                onSuccess={handlePaymentSuccess}
                onFailure={handlePaymentFailure}
                onClose={() => setShowPaymentModal(false)}
                isVisible={showPaymentModal}
            />

            {/* Cancel Subscription Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-brand-secondary rounded-2xl p-8 max-w-md w-full border border-red-500 shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-4">Cancel Subscription</h2>
                        <p className="text-gray-300 mb-6">Are you sure you want to cancel your SnapX subscription? Your access will be revoked immediately upon cancellation.</p>
                        <div className="flex gap-4 justify-end">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                disabled={isProcessingCancel}
                                className="px-6 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Keep Subscription
                            </button>
                            <button
                                onClick={handleCancelSubscription}
                                disabled={isProcessingCancel}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isProcessingCancel ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Cancelling...
                                    </>
                                ) : (
                                    'Cancel Subscription'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Success Toast */}
            {paymentSuccess && (
                <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-semibold">
                        🎉 Operation successful! Your subscription has been updated.
                    </div>
                </div>
            )}

            {/* Error Notifications */}
            {paymentError && (
                <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
                    <ErrorNotification
                        message={paymentError}
                        onDismiss={() => setPaymentError('')}
                        autoDismiss={true}
                        autoDismissTime={5000}
                    />
                </div>
            )}

            {cancelError && (
                <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
                    <ErrorNotification
                        message={cancelError}
                        onDismiss={() => setCancelError('')}
                        autoDismiss={true}
                        autoDismissTime={5000}
                    />
                </div>
            )}

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