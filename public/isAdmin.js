let isAdmin = false;

// Check admin status and then initialize the gallery
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.endsWith('gallery.html')) {
    const category = localStorage.getItem('currentCategory') || 'Gallery';
    document.getElementById('gallery-title').textContent = category;
    checkAdminStatus().then(() => {
      renderGallery();
      renderComments();
      renderAdminControls();
    });
  }
});

// Check the admin status from the server
function checkAdminStatus() {
  return fetch('/isAdmin')
    .then(res => res.json())
    .then(data => {
      isAdmin = data.isAdmin;
    })
    .catch(err => console.error(err));
}

// Render admin login/logout controls
function renderAdminControls() {
  const adminControls = document.getElementById('admin-controls');
  if (isAdmin) {
    adminControls.innerHTML = `<button onclick="logoutAdmin()">Logout</button>`;
  } else {
    adminControls.innerHTML = `<button onclick="loginAdmin()">Login</button>`;
  }
}

// Simple admin login (prompt for password)
function loginAdmin() {
  const password = prompt('Enter admin password:');
  if (!password) return;
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        isAdmin = true;
        renderAdminControls();
        renderGallery();
      } else {
        alert('Invalid password');
      }
    })
    .catch(err => console.error(err));
}

// Admin logout
function logoutAdmin() {
  fetch('/logout')
    .then(res => res.json())
    .then(data => {
      isAdmin = false;
      renderAdminControls();
      renderGallery();
    })
    .catch(err => console.error(err));
}

// Retrieve images for the current category from the server and render them
function renderGallery() {
  const galleryGrid = document.getElementById('gallery-grid');
  galleryGrid.innerHTML = '';
  const category = localStorage.getItem('currentCategory');

  fetch(`/images?category=${encodeURIComponent(category)}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        data.images.forEach(img => {
          const div = document.createElement('div');
          div.className = 'gallery-item';
          // Conditionally include admin buttons only if isAdmin is true
          const adminButtons = isAdmin ? `
            <div class="overlay-buttons">
              <button class="edit-caption-button" onclick="editCaption('${img.id}')">Edit Caption</button>
              <button class="delete-button" onclick="removeImage('${img.id}')">Remove</button>
            </div>` : '';
          div.innerHTML = `
            <img src="${img.path}" alt="${img.name}">
            <div class="item-overlay">
              <span class="caption-text">${img.caption || ''}</span>
              ${adminButtons}
            </div>
          `;
          galleryGrid.appendChild(div);
        });
      }
    })
    .catch(err => console.error(err));
}

// Trigger file input to select images and upload them to the server
function uploadImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = e => {
    const files = e.target.files;
    const category = localStorage.getItem('currentCategory');
    const formData = new FormData();
    formData.append('category', category);
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    fetch('/upload', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          renderGallery();
        }
      })
      .catch(err => console.error(err));
  };
  input.click();
}

// Remove an image by sending a DELETE request to the server
function removeImage(id) {
  fetch(`/images/${id}`, {
    method: 'DELETE'
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        renderGallery();
      }
    })
    .catch(err => console.error(err));
}

// Edit caption: prompt for a new caption and send a PUT request to update the image metadata
function editCaption(id) {
  const newCaption = prompt('Enter a new caption:');
  if (newCaption === null) return; // Cancelled
  fetch(`/images/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption: newCaption })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        renderGallery();
      }
    })
    .catch(err => console.error(err));
}

// Submit a comment for the current gallery category
function submitComment(event) {
  event.preventDefault();
  const category = localStorage.getItem('currentCategory');
  const name = document.getElementById('commentName').value;
  const comment = document.getElementById('commentText').value;

  fetch('/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, name, comment })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('commentForm').reset();
        renderComments();
      }
    })
    .catch(err => console.error(err));
}

// Retrieve and render comments for the current category
function renderComments() {
  const category = localStorage.getItem('currentCategory');
  const commentsContainer = document.getElementById('commentsContainer');
  commentsContainer.innerHTML = '';
  fetch(`/comments?category=${encodeURIComponent(category)}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        data.comments.forEach(comment => {
          const div = document.createElement('div');
          div.className = 'comment';
          div.innerHTML = `
            <span class="comment-name">${comment.name}</span>
            <span class="comment-timestamp">${new Date(comment.timestamp).toLocaleString()}</span>
            <p class="comment-text">${comment.comment}</p>
          `;
          commentsContainer.appendChild(div);
        });
      }
    })
    .catch(err => console.error(err));
}
