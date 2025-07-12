import React from 'react';

const RefundPolicyRenderer = ({ content }) => {
    const renderContent = (content) => {
        if (Array.isArray(content)) {
            return content.map((paragraph, index) => (
                <p key={index} className="text-gray-300 mb-4">{paragraph}</p>
            ));
        }
        return <p className="text-gray-300 mb-6">{content}</p>;
    };

    const renderEmailLink = (text) => {
        const emailRegex = /(support@mongosnap\.live)/g;
        if (emailRegex.test(text)) {
            const parts = text.split(emailRegex);
            return parts.map((part, index) =>
                part === 'support@mongosnap.live' ? (
                    <a
                        key={index}
                        href="mailto:support@mongosnap.live"
                        className="text-brand-quaternary hover:text-white transition-colors"
                    >
                        support@mongosnap.live
                    </a>
                ) : (
                    part
                )
            );
        }
        return text;
    };
    const renderScenarios = (scenarios, type) => {
        const bgClass = type === 'granted' 
            ? 'bg-brand-tertiary/30 rounded-lg p-6 mb-6' 
            : 'bg-red-500/10 border border-red-500/20 rounded-lg p-6';
        
        return (
            <div className={bgClass}>
                {scenarios.map((scenario, index) => (
                    <div key={index}>
                        <h3 className="text-lg font-semibold text-white mb-3">{scenario.title}</h3>
                        <p className={`text-gray-300 ${index < scenarios.length - 1 ? 'mb-4' : ''}`}>
                            {scenario.description}
                        </p>
                    </div>
                ))}
            </div>
        );
    };

    const renderSection = (section) => {
        return (
            <div key={section.id}>
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">{section.title}</h2>
                {section.content && (
                    <div className="text-gray-300 mb-6">
                        {section.hasEmailLink ? (
                            renderEmailLink(section.content)
                        ) : (
                            renderContent(section.content)
                        )}
                    </div>
                )}
                {section.scenarios && renderScenarios(section.scenarios, section.scenarioType)}
            </div>
        );
    };

    return (
        <div className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-white mb-4">{content.introduction.title}</h1>
            <p className="text-gray-300 mb-6">Last updated: {content.lastUpdated}</p>
            
            <p className="text-gray-300 mb-6">{content.introduction.description}</p>
            
            {content.sections.map((section) => renderSection(section))}
        </div>
    );
};

export default RefundPolicyRenderer; 