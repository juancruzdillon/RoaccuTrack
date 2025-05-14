
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : { title: 'RoaccuTrack', body: 'Revisa tu medicación.' };
  const title = data.title || 'RoaccuTrack';
  const options = {
    body: data.body || 'Es hora de tu medicación.',
    icon: '/icon-192x192.png', // Add an icon for notifications
    badge: '/badge-72x72.png', // Add a badge icon
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
