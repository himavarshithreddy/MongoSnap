import React from 'react';

const PrivacyPolicyRenderer = ({ content }) => {
    const renderList = (list, type = 'ul') => {
        if (!list) return null;
        
        if (type === 'ul') {
            return (
                <ul className="text-gray-300 mb-6 space-y-3">
                    {list.map((item, index) => (
                        <li key={index} className="text-gray-300">{item}</li>
                    ))}
                </ul>
            );
        }
        
        if (type === 'definitions') {
            return (
                <ul className="text-gray-300 mb-6 space-y-3">
                    {list.map((item, index) => (
                        <li key={index}>
                            <strong className="text-white">{item.term}</strong> {item.hasLink ? (
                                <>
                                    refers to MongoSnap, accessible from <a href="https://mongosnap.live" rel="external nofollow noopener" target="_blank" className="text-brand-quaternary hover:text-white transition-colors">mongosnap.live</a>
                                </>
                            ) : (
                                item.definition
                            )}
                        </li>
                    ))}
                </ul>
            );
        }
        
        if (type === 'purposes') {
            return (
                <ul className="text-gray-300 mb-6 space-y-3">
                    {list.map((item, index) => (
                        <li key={index}>
                            <strong className="text-white">{item.purpose}</strong>, {item.description}
                        </li>
                    ))}
                </ul>
            );
        }
        
        if (type === 'sharing') {
            return (
                <ul className="text-gray-300 mb-6 space-y-2">
                    {list.map((item, index) => (
                        <li key={index}>
                            <strong className="text-white">{item.situation}:</strong> {item.description}
                        </li>
                    ))}
                </ul>
            );
        }
        
        if (type === 'technologies') {
            return (
                <ul className="text-gray-300 mb-4 space-y-3">
                    {list.map((item, index) => (
                        <li key={index}>
                            <strong className="text-white">{item.name}.</strong> {item.description}
                        </li>
                    ))}
                </ul>
            );
        }
        
        if (type === 'cookieTypes') {
            return (
                <ul className="text-gray-300 mb-6 space-y-4">
                    {list.map((item, index) => (
                        <li key={index}>
                            <strong className="text-white">{item.name}</strong><br/>
                            Type: {item.type}<br/>
                            Administered by: {item.administeredBy}<br/>
                            Purpose: {item.purpose}
                        </li>
                    ))}
                </ul>
            );
        }
        
        if (type === 'contactMethods') {
            return (
                <ul className="text-gray-300 space-y-2">
                    {list.map((item, index) => (
                        <li key={index}>
                            {item.method}: {item.method === "By email" ? (
                                <a href={`mailto:${item.value}`} className="text-brand-quaternary hover:text-white transition-colors">
                                    {item.value}
                                </a>
                            ) : (
                                <a href="/contact" className="text-brand-quaternary hover:text-white transition-colors">
                                    {item.value}
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            );
        }
        
        return null;
    };

    const renderContent = (content) => {
        if (Array.isArray(content)) {
            return content.map((paragraph, index) => (
                <p key={index} className="text-gray-300 mb-4">{paragraph}</p>
            ));
        }
        return <p className="text-gray-300 mb-4">{content}</p>;
    };

    const renderSubsection = (subsection) => {
        return (
            <div key={subsection.id}>
                <h3 className="text-xl font-semibold text-white mt-6 mb-3">{subsection.title}</h3>
                {subsection.content && renderContent(subsection.content)}
                {subsection.list && renderList(subsection.list, subsection.id === 'definitions' ? 'definitions' : 'ul')}
                {subsection.paragraphs && (
                    <div>
                        {subsection.paragraphs.map((paragraph, index) => (
                            <p key={index} className="text-gray-300 mb-4">{paragraph}</p>
                        ))}
                    </div>
                )}
                {subsection.additionalContent && (
                    <div>
                        {subsection.additionalContent.map((content, index) => (
                            <p key={index} className="text-gray-300 mb-4">{content}</p>
                        ))}
                    </div>
                )}
                {subsection.technologies && renderList(subsection.technologies, 'technologies')}
                {subsection.cookieInfo && (
                    <div>
                        {subsection.cookieInfo.map((info, index) => (
                            <p key={index} className="text-gray-300 mb-4">
                                {info.includes('TermsFeed website article') ? (
                                    <>
                                        Cookies can be "Persistent" or "Session" Cookies. Persistent Cookies remain on Your personal computer or mobile device when You go offline, while Session Cookies are deleted as soon as You close Your web browser. You can learn more about cookies on <a href="https://www.termsfeed.com/blog/cookies/#What_Are_Cookies" target="_blank" className="text-brand-quaternary hover:text-white transition-colors">TermsFeed website</a> article.
                                    </>
                                ) : (
                                    info
                                )}
                            </p>
                        ))}
                    </div>
                )}
                {subsection.cookieTypes && renderList(subsection.cookieTypes, 'cookieTypes')}
                {subsection.additionalInfo && (
                    <p className="text-gray-300 mb-6">{subsection.additionalInfo}</p>
                )}
                {subsection.purposes && renderList(subsection.purposes, 'purposes')}
                {subsection.sharingSituations && renderList(subsection.sharingSituations, 'sharing')}
                {subsection.contactMethods && renderList(subsection.contactMethods, 'contactMethods')}
                {subsection.subsections && (
                    <div>
                        {subsection.subsections.map((subSubsection) => (
                            <div key={subSubsection.id}>
                                <h4 className="text-lg font-semibold text-white mt-4 mb-2">{subSubsection.title}</h4>
                                {subSubsection.content && renderContent(subSubsection.content)}
                                {subSubsection.list && renderList(subSubsection.list)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderSection = (section) => {
        return (
            <div key={section.id}>
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">{section.title}</h2>
                {section.content && renderContent(section.content)}
                {section.list && renderList(section.list)}
                {section.subsections && (
                    <div>
                        {section.subsections.map((subsection) => renderSubsection(subsection))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="prose prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-white mb-4">{content.introduction.title}</h1>
            <p className="text-gray-300 mb-6">Last updated: {content.lastUpdated}</p>
            
            <p className="text-gray-300 mb-6">{content.introduction.description}</p>
            <p className="text-gray-300 mb-6">{content.introduction.agreement}</p>
            
            {content.sections.map((section) => renderSection(section))}
        </div>
    );
};

export default PrivacyPolicyRenderer; 