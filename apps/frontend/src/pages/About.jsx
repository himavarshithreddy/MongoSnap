import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Target, 
    Lightbulb, 
    CheckCircle,
    Github,
    Linkedin
} from 'lucide-react';
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';
import PublicLayout from '../components/PublicLayout';

const About = () => {
    const navigate = useNavigate();
    const getActionButton = useAuthActionButton();

    useEffect(() => {
        document.title = "About Us - MongoSnap";
    }, []);



    const developer = {
        name: "Himavarshith Reddy",
        role: "Founder & Developer",
        bio: "Full-stack developer passionate about AI and database technologies.",
        expertise: ["Full-Stack Development", "AI/ML", "Database Systems", "DevOps", "Product Development"],
        github: "https://github.com/himavarshithreddy",
        linkedin: "https://www.linkedin.com/in/himavarshithreddygundam/"
    };



    return (
        <PublicLayout>
            {/* Hero Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                            Building the Future of 
                            <span className="text-brand-quaternary"> Database </span>
                            Interaction
                        </h1>
                        <p className="text-xl text-gray-300 leading-relaxed mb-8">
                            Making database querying as natural as having a conversation. 
                            Transform how you interact with MongoDB using AI-powered natural language processing.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            {getActionButton()}
                            <button
                                onClick={() => navigate('/contact')}
                                className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                Get in Touch
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="py-20 bg-brand-secondary/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                                Our Mission
                            </h2>
                            <p className="text-lg text-gray-300 leading-relaxed mb-6">
                                Making powerful database technologies accessible to all developers through intelligent AI 
                                that converts natural language into optimized MongoDB queries.
                            </p>
                            <p className="text-lg text-gray-300 leading-relaxed">
                                Focus on building great applications, not wrestling with complex query syntax.
                            </p>
                        </div>
                        <div className="relative">
                            <div className="bg-brand-secondary rounded-xl p-8 border border-brand-tertiary">
                                <div className="flex items-center gap-3 mb-6">
                                    <Target className="text-brand-quaternary" size={32} />
                                    <h3 className="text-2xl font-bold text-white">Our Vision</h3>
                                </div>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="text-brand-quaternary mt-1 flex-shrink-0" size={16} />
                                        <span className="text-gray-300">The go-to platform for MongoDB query generation</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="text-brand-quaternary mt-1 flex-shrink-0" size={16} />
                                        <span className="text-gray-300">Support for multiple database systems</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <CheckCircle className="text-brand-quaternary mt-1 flex-shrink-0" size={16} />
                                        <span className="text-gray-300">Advanced analytics and optimization tools</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="absolute -top-4 -right-4 bg-brand-quaternary/20 backdrop-blur-sm rounded-lg p-3 border border-brand-quaternary/50">
                                <Lightbulb className="text-brand-quaternary" size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* Developer Section */}
            <section className="py-20 bg-brand-secondary/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Meet the Developer
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            The passionate developer behind MongoSnap, committed to transforming how developers interact with databases.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className="bg-brand-secondary rounded-xl p-8 border border-brand-tertiary">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-semibold text-white mb-2">{developer.name}</h3>
                                <p className="text-brand-quaternary font-medium mb-4">{developer.role}</p>
                                <p className="text-gray-300 leading-relaxed mb-6">{developer.bio}</p>
                                
                                {/* Social Links */}
                                <div className="flex justify-center gap-4 mb-6">
                                    <a
                                        href={developer.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-tertiary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 cursor-pointer"
                                    >
                                        <Github size={20} />
                                        <span>GitHub</span>
                                    </a>
                                    <a
                                        href={developer.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-tertiary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 cursor-pointer"
                                    >
                                        <Linkedin size={20} />
                                        <span>LinkedIn</span>
                                    </a>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-3 text-center">EXPERTISE</h4>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {developer.expertise.map((skill, skillIndex) => (
                                        <span 
                                            key={skillIndex}
                                            className="px-3 py-1 bg-brand-tertiary text-brand-quaternary text-sm rounded-full"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
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
                            Ready to Join Our Mission?
                        </h2>
                        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                            Whether you're a developer looking to streamline your workflow or interested in 
                            collaborating, we'd love to connect with you.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            {getActionButton()}
                            
                            <button
                                onClick={() => navigate('/contact')}
                                className="px-8 py-4 border-2 border-brand-quaternary text-brand-quaternary rounded-lg hover:bg-brand-quaternary hover:text-white transition-all duration-200 font-semibold text-lg cursor-pointer"
                            >
                                Get in Touch
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </PublicLayout>
    );
};

export default About; 