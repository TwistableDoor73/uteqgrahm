// Usa idb v7 (global `idb`)
var DEFAULT_IMAGE = '/src/images/sf-boat.jpg';
var dbPromise = idb.openDB('posts-store', 2, {
  upgrade: function (db) {
    if (!db.objectStoreNames.contains('posts')) {
      db.createObjectStore('posts', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('sync-posts')) {
      db.createObjectStore('sync-posts', { keyPath: 'id' });
    }
  }
});

function writeData(st, data) {
  return dbPromise.then(function (db) {
    var tx = db.transaction(st, 'readwrite');
    tx.objectStore(st).put(data);
    return tx.done;
  });
}

function readAllData(st) {
  return dbPromise.then(function (db) {
    return db.transaction(st, 'readonly').objectStore(st).getAll();
  });
}

function clearAllData(st) {
  return dbPromise.then(function (db) {
    var tx = db.transaction(st, 'readwrite');
    tx.objectStore(st).clear();
    return tx.done;
  });
}

function deleteItemFromData(st, id) {
  return dbPromise.then(function (db) {
    var tx = db.transaction(st, 'readwrite');
    tx.objectStore(st).delete(id);
    return tx.done;
  });
}
