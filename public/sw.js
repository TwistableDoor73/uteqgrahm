importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

var CACHE_STATIC_NAME = 'static-v15';
var CACHE_DYNAMIC_NAME = 'dynamic-v15';

var STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/help',
  '/help/index.html',
  '/src/css/help.css',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/idb.js',
  '/src/js/utility.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/images/icons/main-image.jpg',
  '/src/images/sf-boat.jpg',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing Service Worker ...', event);
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then(function(cache) {
        console.log('[Service Worker] Precaching App Shell');
        return cache.addAll(STATIC_FILES);
      })
  );
});


self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating Service Worker ....', event);
  event.waitUntil(
    caches.keys()
      .then(function(keyList) {
        return Promise.all(keyList.map(function(key) {
          if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
            console.log('[Service Worker] Removing old cache.', key);
            return caches.delete(key);
          }
        }));
      })
  );
  return self.clients.claim();
});


function isInArray(string, array) {
  var cachePath;
  if (string.indexOf(self.origin) === 0) {
    cachePath = string.substring(self.origin.length);
  } else {
    cachePath = string;
  }
  return array.indexOf(cachePath) > -1;
}

self.addEventListener('fetch', function (event) {
  var url = 'https://uteqgram-c369d-default-rtdb.firebaseio.com/posts.json';

  if (event.request.url.indexOf(url) > -1) {
    // Network first; copia en IndexedDB
    event.respondWith(
      fetch(event.request).then(function (res) {
        // Solo actualiza IndexedDB si Firebase respondió bien; un error no debe borrar la copia offline
        if (!res.ok) return res;
        var clonedRes = res.clone();
        clearAllData('posts')
          .then(function () { return clonedRes.json(); })
          .then(function (data) {
            for (var key in data) {
              // Firebase no trae id dentro del objeto; el keyPath 'id' lo necesita
              writeData('posts', Object.assign({ id: key }, data[key]));
            }
          });
        return res;
      })
    );
  } else if (isInArray(event.request.url, STATIC_FILES)) {
    // Cache only
    event.respondWith(caches.match(event.request));
  } else {
    event.respondWith(
      caches.match(event.request).then(function (response) {
        if (response) return response;
        return fetch(event.request)
          .then(function (res) {
            return caches.open(CACHE_DYNAMIC_NAME).then(function (cache) {
              cache.put(event.request.url, res.clone());
              return res;
            });
          })
          .catch(function () {
            return caches.open(CACHE_STATIC_NAME).then(function (cache) {
              if (event.request.headers.get('accept').includes('text/html')) {
                return cache.match('/offline.html');
              }
            });
          });
      })
    );
  }
});

self.addEventListener('sync', function(event) {
  console.log('[Service Worker] Background syncing', event);
  if (event.tag === 'sync-new-posts') {
    console.log('[Service Worker] Syncing new Posts');
    event.waitUntil(
      readAllData('sync-posts')
        .then(function(data) {
          // Promise.all + map: cada post conserva su propio dt y waitUntil espera todos los envíos
          return Promise.all(data.map(function(dt) {
            return fetch('https://uteqgram-c369d-default-rtdb.firebaseio.com/post.json', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                id: dt.id,
                title: dt.title,
                location: dt.location,
                image: DEFAULT_IMAGE
              })
            })
              .then(function(res) {
                console.log('Sent data', res);
                if (res.ok) {
                  return deleteItemFromData('sync-posts', dt.id);
                }
                // Error del servidor (p. ej. 401): fallar para que el navegador reintente
                throw new Error('Firebase respondió ' + res.status);
              })
              .catch(function(err) {
                console.log('Error while sending data', err);
                // Relanzar el error: así la sincronización falla y el navegador la reintenta
                throw err;
              });
          }));
        })
    );
  }
});
