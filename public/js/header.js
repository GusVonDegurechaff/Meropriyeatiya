fetch('/components/header.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('header-container').innerHTML = html;

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role === 'admin') {
        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
          adminLink.style.display = 'inline-block';
        }
      }
    }
  });

function logout() {
  localStorage.removeItem('user');
  window.location.href = '/';
}
