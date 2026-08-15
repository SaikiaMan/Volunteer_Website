self.addEventListener('push', (event) => {
    let data = {
        title: 'EventEase',
        body: 'You have a new notification.',
        url: '/',
        eventId: null
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (error) {
            console.error('Failed to parse push data:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/assets/favicon.ico',
            badge: '/assets/favicon.ico',
            data: {
                url: data.url || '/',
                eventId: data.eventId || null
            }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notificationData = event.notification.data || {};
    const eventId = notificationData.eventId;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then((clientList) => {
            const appUrl = eventId
                ? new URL(
                    `./app.html?eventId=${encodeURIComponent(eventId)}`,
                    self.registration.scope
                ).href
                : new URL('./app.html', self.registration.scope).href;

            for (const client of clientList) {
                if ('navigate' in client && 'focus' in client) {
                    return client.navigate(appUrl).then(() => client.focus());
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(appUrl);
            }
        })
    );
});