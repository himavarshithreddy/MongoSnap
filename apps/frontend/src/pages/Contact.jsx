import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Mail, 
    MapPin, 
    Phone, 
    Clock, 
    Send, 
    CheckCircle, 
    AlertCircle,
    MessageSquare,
    Users,
    Headphones,
    ArrowRight
} from 'lucide-react';
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';
import { useUser } from '../hooks/useUser';
import PublicLayout from '../components/PublicLayout';

const Contact = () => {
    const navigate = useNavigate();
    const getActionButton = useAuthActionButton();
    const { user } = useUser();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
        category: 'general'
    });
    const [formLoading, setFormLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        document.title = "Contact Us - MongoSnap";
    }, []);

    const contactInfo = [
        {
            icon: Mail,
            title: "Email Support",
            content: "support@mongosnap.live",
            description: "Get help with technical questions and account issues",
            action: "mailto:support@mongosnap.live"
        },
        {
            icon: Phone,
            title: "Phone Number",
            content: "+91 7815849505",
            description: "Call us for immediate assistance during business hours",
            action: "tel:+917815849505"
        },
        {
            icon: MapPin,
            title: "Office Address",
            content: "18-14-128/1A, Maruthi Nagar, Street Number 3, Siddipet, Telangana, 502103, India",
            description: "Visit us at our headquarters",
            action: null
        }
    ];

    const supportCategories = [
        { value: 'general', label: 'General Inquiry' },
        { value: 'technical', label: 'Technical Support' },
        { value: 'billing', label: 'Billing & Pricing' },
        { value: 'partnership', label: 'Partnership' },
        { value: 'feedback', label: 'Feature Request' },
        { value: 'bug', label: 'Bug Report' }
    ];



    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');
        setSuccess('');

        // Basic validation
        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            setError('Please fill in all required fields.');
            setFormLoading(false);
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address.');
            setFormLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/contact/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(user && { 'Authorization': `Bearer ${localStorage.getItem('token')}` })
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setSuccess(data.message || 'Thank you for your message! We\'ll get back to you within 24 hours.');
                setFormData({
                    name: '',
                    email: '',
                    subject: '',
                    message: '',
                    category: 'general'
                });
            } else {
                setError(data.message || 'Failed to send message. Please try again or email us directly.');
            }
        } catch (err) {
            console.error('Error submitting contact form:', err);
            setError('Failed to send message. Please try again or email us directly.');
        } finally {
            setFormLoading(false);
        }
    };



    return (
        <PublicLayout>
            {/* Hero Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                            Get in <span className="text-brand-quaternary">Touch</span>
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed mb-8">
                            Have questions about MongoSnap? Need technical support? Want to explore partnership opportunities? 
                            We're here to help and would love to hear from you.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="mailto:support@mongosnap.live"
                                className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 group cursor-pointer"
                            >
                                Quick Email
                                <Mail size={20} />
                            </a>
                            <button
                                onClick={() => document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth' })}
                                className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                Contact Form
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Info Grid */}
            <section className="py-20 bg-brand-secondary/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Multiple Ways to Reach Us
                        </h2>
                        <p className="text-xl text-gray-300">
                            Choose the method that works best for you
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {contactInfo.map((info, index) => (
                            <div 
                                key={index}
                                className="bg-brand-secondary rounded-xl p-6 border border-brand-tertiary hover:border-brand-quaternary/50 transition-all duration-300 text-center"
                            >
                                <div className="w-16 h-16 bg-brand-quaternary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <info.icon className="text-brand-quaternary" size={28} />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">{info.title}</h3>
                                <div className="text-brand-quaternary font-medium mb-2 whitespace-pre-line">
                                    {info.content}
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                                    {info.description}
                                </p>
                                {info.action && (
                                    <a
                                        href={info.action}
                                        className="inline-flex items-center gap-2 text-brand-quaternary hover:text-white transition-colors duration-200 text-sm font-medium cursor-pointer"
                                    >
                                        Contact Now
                                        <ArrowRight size={14} />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contact Form Section */}
            <section id="contact-form" className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Send Us a Message
                        </h2>
                        <p className="text-xl text-gray-300">
                            Fill out the form below and we'll get back to you as soon as possible
                        </p>
                    </div>

                    <div className="bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary">
                        {success && (
                            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-3">
                                <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                                <span className="text-green-400">{success}</span>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                                <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
                                <span className="text-red-400">{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="name" className="block text-white font-medium mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 bg-brand-primary border border-brand-tertiary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-quaternary transition-colors"
                                        placeholder="Your full name"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="email" className="block text-white font-medium mb-2">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 bg-brand-primary border border-brand-tertiary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-quaternary transition-colors"
                                        placeholder="your.email@company.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="category" className="block text-white font-medium mb-2">
                                    Category
                                </label>
                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-brand-primary border border-brand-tertiary rounded-lg text-white focus:outline-none focus:border-brand-quaternary transition-colors"
                                >
                                    {supportCategories.map((category) => (
                                        <option key={category.value} value={category.value}>
                                            {category.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-white font-medium mb-2">
                                    Subject *
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    value={formData.subject}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-brand-primary border border-brand-tertiary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-quaternary transition-colors"
                                    placeholder="Brief description of your inquiry"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-white font-medium mb-2">
                                    Message *
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleInputChange}
                                    rows={6}
                                    className="w-full px-4 py-3 bg-brand-primary border border-brand-tertiary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-quaternary transition-colors resize-vertical"
                                    placeholder="Please provide as much detail as possible about your inquiry..."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={formLoading}
                                className="w-full px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {formLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        Send Message
                                        <Send size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 p-4 bg-brand-tertiary/50 rounded-lg">
                            <p className="text-gray-300 text-sm text-center">
                                <strong>Response Time:</strong> We typically respond within 24 hours during business days. 
                                For urgent technical issues, please email us directly at{' '}
                                <a href="mailto:support@mongosnap.live" className="text-brand-quaternary hover:text-white transition-colors">
                                    support@mongosnap.live
                                </a>
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
                            Don't wait - start building better MongoDB queries today with our AI-powered platform.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            {getActionButton()}
                            
                            <button
                                onClick={() => navigate('/pricing')}
                                className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                View Pricing
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default Contact; 