var shareImageButton = document.querySelector('#share-image-button');
var sharedMomentsArea = document.querySelector('#shared-moments');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var form = document.querySelector('form');
var titleInput = document.querySelector('#title');
var locationInput = document.querySelector('#location');

function openCreatePostModal() {
  createPostArea.style.transform = 'translateY(0)';
  if (deferredPrompt) {
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function(choiceResult) {
      console.log(choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        console.log('User cancelled installation');
      } else {
        console.log('User added to home screen');
      }
    });

    deferredPrompt = null;
  }
}

function closeCreatePostModal() {
  createPostArea.style.transform = 'translateY(100vh)';
}

shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

function clearCards() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}

function createCard(data) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title';
  cardTitle.style.backgroundImage = 'url("' + data.image + '")';
  cardTitle.style.backgroundSize = 'cover';
  cardTitle.style.height = '180px';
  cardWrapper.appendChild(cardTitle);
  var cardTitleTextElement = document.createElement('h2');
  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;
  cardTitle.appendChild(cardTitleTextElement);
  var cardSupportingText = document.createElement('div');
  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';
  cardWrapper.appendChild(cardSupportingText);
  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

function updateUI(data) {
  clearCards();
  for (var i = 0; i < data.length; i++) {
    createCard(data[i]);
  }
}

var url = 'https://uteqgram-pwa-default-rtdb.firebaseio.com/post.json';
var networkDataReceived = false;

fetch(url)
  .then(function(res) {
    if (!res.ok) throw new Error('Firebase respondió ' + res.status);
    return res.json();
  })
  .then(function(data) {
    networkDataReceived = true;
    console.log('From web', data);
    var dataArray = [];
    for (var key in data) dataArray.push(data[key]);
    updateUI(dataArray);
  })
  .catch(function(err) {
    console.log('[Feed] Error en fetch a la red (usando IndexedDB como respaldo):', err);
  });

if ('indexedDB' in window) {
  readAllData('posts').then(function(data) {
    if (!networkDataReceived) {
      console.log('From cache', data);
      updateUI(data);
    }
  });
}

function sendData() {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      id: new Date().toISOString(),
      title: titleInput.value,
      location: locationInput.value,
      image: DEFAULT_IMAGE
    })
  })
    .then(function(res) {
      console.log('Sent data', res);
      if (!res.ok) throw new Error('Firebase respondió ' + res.status);
      return fetch(url);
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Firebase respondió ' + res.status);
      return res.json();
    })
    .then(function(data) {
      var dataArray = [];
      for (var key in data) dataArray.push(data[key]);
      updateUI(dataArray);
    })
    .catch(function(err) {
      console.log('[Feed] Error al enviar el post:', err);
    });
}

form.addEventListener('submit', function(event) {
  event.preventDefault();

  if (titleInput.value.trim() === '' || locationInput.value.trim() === '') {
    alert('Please enter valid data!');
    return;
  }

  closeCreatePostModal();

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(function(sw) {
      var post = {
        id: new Date().toISOString(),
        title: titleInput.value,
        location: locationInput.value
      };
      writeData('sync-posts', post)
        .then(function() { return sw.sync.register('sync-new-posts'); })
        .then(function() {
          var snackbarContainer = document.querySelector('#confirmation-toast');
          snackbarContainer.MaterialSnackbar.showSnackbar({ message: 'Your Post was saved for syncing!' });
        })
        .catch(function(err) { console.log(err); });
    });
  } else {
    sendData();
  }
});
