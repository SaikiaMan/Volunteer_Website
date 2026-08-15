let pushServiceWorkerRegistration = null;

const API_BASE_URL = 'http://localhost:3001/api';

async function registerPushServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.error('Service workers are not supported by this browser.');
        return null;
    }

    try {
        pushServiceWorkerRegistration =
            await navigator.serviceWorker.register('./sw.js');

        console.log(
            'Push service worker registered:',
            pushServiceWorkerRegistration.scope
        );

        return pushServiceWorkerRegistration;
    } catch (error) {
        console.error('Service worker registration failed:', error);
        return null;
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('Notifications are not supported by this browser.');
        return false;
    }

    if (Notification.permission === 'granted') {
        console.log('Notification permission already granted.');
        return true;
    }

    if (Notification.permission === 'denied') {
        alert(
            'Notifications are blocked for EventEase. Please enable them in your browser settings.'
        );
        return false;
    }

    const permission = await Notification.requestPermission();

    console.log('Notification permission:', permission);

    return permission === 'granted';
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}

async function getVapidPublicKey() {
    const response = await fetch(`${API_BASE_URL}/push/public-key`);

    if (!response.ok) {
        throw new Error('Failed to fetch VAPID public key');
    }

    const result = await response.json();

    if (!result.success || !result.publicKey) {
        throw new Error('VAPID public key is missing');
    }

    return result.publicKey;
}

async function subscribeToPush() {
    try {
        const registration =
            pushServiceWorkerRegistration ||
            await navigator.serviceWorker.ready;

        const publicKey = await getVapidPublicKey();

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }

        console.log('Push subscription created:', subscription);

        const token = localStorage.getItem('volunteerToken');

        if (!token) {
            throw new Error('User is not logged in.');
        }

        const subscriptionJson = subscription.toJSON();

        const response = await fetch(
            `${API_BASE_URL}/push/subscribe`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(subscriptionJson)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || 'Failed to save push subscription'
            );
        }

        console.log('Push subscription saved successfully:', result);

        return true;

    } catch (error) {
        console.error('Push subscription failed:', error);
        return false;
    }
}

async function enablePushNotifications() {
    const granted = await requestNotificationPermission();

    if (!granted) {
        return false;
    }

    return await subscribeToPush();
}

window.registerPushServiceWorker = registerPushServiceWorker;
window.requestNotificationPermission = requestNotificationPermission;
window.subscribeToPush = subscribeToPush;
window.enablePushNotifications = enablePushNotifications;

window.addEventListener('load', () => {
    registerPushServiceWorker();
});