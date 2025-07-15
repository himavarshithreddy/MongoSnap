export const refundPolicyContent = {
    lastUpdated: "July 12, 2025",
    introduction: {
        title: "Refund Policy",
        description: "Thank you for subscribing to MongoSnap's services. We hope you are satisfied with our services, but if not, we're here to help."
    },
    sections: [
        {
            id: "cancellation-policy",
            title: "1. Cancellation Policy",
            content: "Subscribers may cancel their recurring subscription at any time. Upon cancellation, your access to MongoSnap services will be revoked immediately. No further access will be provided after cancellation, regardless of the remaining time in your billing cycle."
        },
        {
            id: "refund-eligibility",
            title: "2. Refund Eligibility",
            content: [
                "To be eligible for a refund, you must submit a request within 3 days of your subscription start date. Refunds may be considered on a case-by-case basis and are granted at the sole discretion of MongoSnap.",
                "Refund requests can be made if you encounter technical issues that prevent you from using our service and that cannot be resolved by our support team. Proof of the issue may be required.",
                "Please note that refunds are not guaranteed and may vary depending on the circumstances. Refund requests due to issues beyond MongoSnap's control (e.g., changes in personal circumstances, third-party hardware or software failures, etc.) will not be honored."
            ]
        },
        {
            id: "refund-process",
            title: "3. Process for Requesting a Refund",
            content: "To request a refund, please contact our customer support team at support@mongosnap.live. Include your account information, subscription details, and a brief explanation of why you are requesting a refund.",
            hasEmailLink: true
        },
        {
            id: "refund-processing",
            title: "4. Refund Processing",
            content: "Once your refund request is received and inspected, we will send you an email to notify you of the approval or rejection of your refund. If approved, your refund will be processed, and a credit will automatically be applied to your original method of payment within a certain number of days. Please note that refunds can only be made back to the original payment method used at the time of purchase."
        },
        {
            id: "policy-changes",
            title: "5. Changes to Refund Policy",
            content: "MongoSnap reserves the right to modify this refund policy at any time. Changes will take effect immediately upon their posting on the website. By continuing to use our services after changes are made, you agree to be bound by the revised policy."
        },
        {
            id: "contact-us",
            title: "6. Contact Us",
            content: "If you have any questions about our refund policy, please contact us at support@mongosnap.live.",
            hasEmailLink: true
        },
        {
            id: "refunds-granted",
            title: "Scenarios Where Refunds Would Typically Be Granted:",
            scenarios: [
                {
                    title: "1. Technical Issues",
                    description: "The customer experiences persistent technical issues that prevent them from using the SaaS product effectively, despite multiple attempts by the support team to resolve the problem. For example, the software fails to load or crashes frequently, impeding the customer's ability to perform necessary tasks."
                },
                {
                    title: "2. Misrepresentation of Features",
                    description: "The features or capabilities of the SaaS product were misrepresented on the website or during the sales process, and the product does not perform as advertised. For example, if the product was sold with the promise of specific functionalities that are not actually available."
                }
            ],
            scenarioType: "granted"
        },
        {
            id: "refunds-not-granted",
            title: "Scenarios Where Refunds Would Not Typically Be Granted:",
            scenarios: [
                {
                    title: "1. Change of Mind",
                    description: "The customer decides they no longer want or need the SaaS product after the refund eligibility period has passed. For example, they found a different product they prefer, or they no longer need the service due to changes in their business."
                },
                {
                    title: "2. Failure to Cancel",
                    description: "The customer forgot to cancel their subscription before the renewal date and was charged for another cycle. It is the customer's responsibility to manage their subscription and cancel it before the billing cycle if they do not wish to continue."
                },
                {
                    title: "3. External Factors",
                    description: "The customer is unable to use the SaaS product due to factors outside of MongoSnap's control, such as incompatible hardware, poor internet connection, or issues with third-party software or services."
                }
            ],
            scenarioType: "not-granted"
        }
    ]
}; 