const webpush = require('web-push');

const {
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
} = process.env;

const missingVariables = [
    ['VAPID_SUBJECT', VAPID_SUBJECT],
    ['VAPID_PUBLIC_KEY', VAPID_PUBLIC_KEY],
    ['VAPID_PRIVATE_KEY', VAPID_PRIVATE_KEY]
]
    .filter(([, value]) => !value || !value.trim())
    .map(([name]) => name);

if (missingVariables.length > 0) {
    throw new Error(
        `Missing required VAPID environment variables: ${missingVariables.join(', ')}`
    );
}

webpush.setVapidDetails(
    VAPID_SUBJECT.trim(),
    VAPID_PUBLIC_KEY.trim(),
    VAPID_PRIVATE_KEY.trim()
);

console.log('Web Push configured successfully');

module.exports = webpush;