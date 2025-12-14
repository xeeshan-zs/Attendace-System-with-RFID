import emailjs from '@emailjs/browser';

// CONFIGURATION
// User Provided Keys:
const PUBLIC_KEY = "gmBtwJOlcKZyX1xA2";
const TEMPLATE_ID_WELCOME = "template_kvue998";

// MISSING KEYS (User needs to update these):
const SERVICE_ID = "service_gmail"; // Example: 'service_xyz', 'default_service', 'service_gmail'

export const sendAcceptanceEmail = async (userEmail, userName, tempPassword) => {
    try {
        const templateParams = {
            to_name: userName,
            to_email: userEmail,
            message: `Your account has been successfully created.`,
            login_email: userEmail,
            login_password: tempPassword, // NOTE: Add {{login_password}} to your EmailJS template if you want the user to receive it.
        };

        const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID_WELCOME, templateParams, PUBLIC_KEY);
        console.log('SUCCESS!', response.status, response.text);
        return { success: true };
    } catch (error) {
        console.error('FAILED...', error);
        return { success: false, error: error };
    }
};

export const sendRejectionEmail = async (userEmail, userName) => {
    // Placeholder: User hasn't provided a rejection template yet.
    console.warn("Rejection Email Template ID not configured.");
    return { success: false, message: "No template configured" };
};
