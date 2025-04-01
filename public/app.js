let isAdmin = false;

// For gallery page, check admin status and then initialize gallery and comments.
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

// Check admin status from the server
function checkAdminStatus() {
  return fetch('/isAdmin')
    .then(res => res.json())
    .then(data => {
      isAdmin = data.isAdmin;
    })
    .catch(err => console.error(err));
}

// Render admin controls (if admin, show logout button; if not, no admin controls)
function renderAdminControls() {
  const adminControls = document.getElementById('admin-controls');
  const uploadControls = document.getElementById('upload-controls');
  if (isAdmin) {
    adminControls.innerHTML = `<button onclick="logoutAdmin()">Logout</button>`;
    // Show upload controls if admin
    uploadControls.style.display = 'block';
  } else {
    adminControls.innerHTML = `<a href="login.html">Admin Login</a>`;
    uploadControls.style.display = 'none';
  }
}

// Admin logout function
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

// Submit admin login from login.html
function submitLogin(event) {
  event.preventDefault();
  const password = document.getElementById('adminPassword').value;
  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.location.href = 'gallery.html';
      } else {
        alert('Invalid password');
      }
    })
    .catch(err => console.error(err));
}

// Navigation from index to gallery
function navigate(category) {
  localStorage.setItem('currentCategory', category);
  window.location.href = 'gallery.html';
}

// Go back to home page
function goHome() {
  window.location.href = 'index.html';
}

// Retrieve and render images for the current category
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

// Trigger file input to upload images (only available to admin)
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
          console.log("Uploaded files:", data.files);
          // Wait 500ms before re-rendering the gallery to allow file writes to complete
          setTimeout(() => {
            renderGallery();
          }, 500);
        } else {
          console.error("Upload failed:", data.message);
        }
      })
      .catch(err => console.error(err));
  };
  input.click();
}

// Remove an image (admin only)
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

// Edit caption for an image (admin only)
function editCaption(id) {
  const newCaption = prompt('Enter a new caption:');
  if (newCaption === null) return;
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
