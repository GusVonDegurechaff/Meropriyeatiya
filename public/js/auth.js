document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const login = document.getElementById("login").value;
  const password = document.getElementById("password").value;

  const response = await fetch("http://localhost:3000/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password })
  });

  const data = await response.json();

if (data.success) {
  localStorage.setItem("userId", data.userId);
  localStorage.setItem("role", data.role);
  localStorage.setItem("fullName", data.fullName);

  // 👇 Сохраняем объединённый объект до перехода
  localStorage.setItem('user', JSON.stringify({
    userId: data.userId,
    role: data.role,
    fullName: data.fullName
  }));

  if (data.role === "admin") {
    window.location.href = "/frontend/admin.html";
  } else {
    window.location.href = "/frontend/meropriyatiya.html";
  }
} else {
    alert("Неверный логин или пароль");
  }
});
