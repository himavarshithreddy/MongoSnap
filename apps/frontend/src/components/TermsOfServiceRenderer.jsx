import React from 'react';

const TermsOfServiceRenderer = ({ content }) => {
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
    const renderList = (list) => {
        if (!list) return null;
        
        return (
            <ul className="text-gray-300 mb-4 space-y-2">
                {list.map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
        );
    };

    const renderSection = (section) => {
        return (
            <div key={section.id}>
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">{section.title}</h2>
                {section.content && (
                    <div className="text-gray-300 mb-6">
                        {section.content.includes('support@mongosnap.live') ? (
                            renderEmailLink(section.content)
                        ) : (
                            renderContent(section.content)
                        )}
                    </div>
                )}
                {section.prohibitedUses && (
                    <>
                        {renderList(section.prohibitedUses)}
                        <p className="text-gray-300 mb-4">Additionally, you agree not to:</p>
                        {renderList(section.additionalProhibitions)}
                    </>
                )}
                {section.dmcaRequirements && (
                    <>
                        {renderList(section.dmcaRequirements)}
                        <p className="text-gray-300 mb-6">{section.additionalInfo}</p>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-white mb-4 text-center">{content.introduction.title}</h1>
            <p className="text-gray-300 mb-6">Last updated: {content.lastUpdated}</p>
            
            <p className="text-gray-300 mb-4">{content.introduction.description}</p>
            
            {content.introduction.content.map((paragraph, index) => (
                <p key={index} className="text-gray-300 mb-4">
                    {paragraph.includes('support@mongosnap.live') ? (
                        renderEmailLink(paragraph)
                    ) : (
                        paragraph
                    )}
                </p>
            ))}
            
            {content.sections.map((section) => renderSection(section))}
        </div>
    );
};

export default TermsOfServiceRenderer; 