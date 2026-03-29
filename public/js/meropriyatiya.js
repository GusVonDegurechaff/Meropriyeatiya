document.addEventListener("DOMContentLoaded", () => {
  const eventList = document.getElementById("eventList");
  const addEventBtn = document.getElementById("addEventBtn");
  const applyFiltersBtn = document.getElementById("applyFiltersBtn");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");

  const userId = parseInt(localStorage.getItem("userId"));
  const role = localStorage.getItem("role"); // 1 — админ, 0 — препод

  let currentMode = "create";
  let currentEventId = null;
  let participants = [];

  async function loadEvents(params = "") {
    try {
      const res = await fetch(`/api/events${params ? `?${params}` : ""}`);
      const events = await res.json();
      renderEvents(events);
    } catch (err) {
      console.error("Ошибка при загрузке мероприятий:", err);
      eventList.innerHTML = "<p>Не удалось загрузить мероприятия.</p>";
    }
  }

  function renderEvents(events) {
    eventList.innerHTML = "";

    if (!events || events.length === 0) {
      eventList.innerHTML = "<p>Мероприятий не найдено.</p>";
      return;
    }

    for (const event of events) {
      const card = document.createElement("div");
      card.className = "event-card";

      const canEdit = event.OrganizerId === userId || role === 'admin';

      card.innerHTML = `
        <h3>${event.Title || "Без названия"}</h3>
        <p>📅 Дата: ${new Date(event.Date).toLocaleDateString()}</p>
        <p>🏫 Место: ${event.Location || "—"}</p>
        <p>🎯 Тип: ${event.Type || "—"} | 🌍 Уровень: ${event.Lvl || "—"}</p>
        <p>👤 Преподаватель: ${event.OrganizerName || "Неизвестно"}</p>
        <div class="card-actions">
          ${canEdit ? `
            <button class="edit-btn" data-id="${event.EventId}">✏️ Редактировать</button>
            <button class="delete-btn" data-id="${event.EventId}">🗑️ Удалить</button>
          ` : ""}
          ${event.OrderFilePath ? `<a href="${event.OrderFilePath}" target="_blank">📎 Приказ</a>` : ""}
        </div>
      `;

      eventList.appendChild(card);
    }

    document.querySelectorAll(".edit-btn").forEach(btn =>
      btn.addEventListener("click", () => editEvent(btn.dataset.id))
    );
    document.querySelectorAll(".delete-btn").forEach(btn =>
      btn.addEventListener("click", () => deleteEvent(btn.dataset.id))
    );
  }

  async function deleteEvent(id) {
    if (!confirm("Удалить мероприятие?")) return;

    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("Мероприятие удалено");
        await loadEvents();
      } else {
        alert("Ошибка при удалении");
      }
    } catch (err) {
      console.error("Ошибка при удалении:", err);
    }
  }

  async function editEvent(id) {
    console.log("Editing event ID:", id, "as role:", role);
    try {
      const res = await fetch(`/api/events/${id}`);
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Event data:", data);
      openEventModal("edit", data);
    } catch (err) {
      console.error("Ошибка загрузки мероприятия:", err);
      alert("Ошибка загрузки мероприятия");
    }
  }

function openEventModal(mode = "create", data = null) {
  currentMode = mode;
  currentEventId = data?.EventId || null;

  const modal = document.getElementById("eventModal");
  const title = document.getElementById("modalTitle");
  const tabs = document.getElementById("modalTabs");
  const form = document.getElementById("eventForm");

  modal.classList.remove("hidden");

  if (mode === "edit") {
    title.textContent = "Редактировать мероприятие";
    tabs.classList.remove("hidden");
    loadParticipants(currentEventId);
    const groupFilter = document.getElementById('groupFilter');
    if (groupFilter.options.length <= 1) {
      initGroupFilter();
    }

    document.getElementById("eventTitle").value = data.Title || "";
    document.getElementById("eventDate").value = (data.Date || "").substring(0, 10);
    document.getElementById("eventPlace").value = data.Location || "";
    document.getElementById("eventType").value = data.Type || "";
    document.getElementById("eventLevel").value = data.Lvl || "";

    // Загружаем участников с сервера
  } else {
    title.textContent = "Добавить мероприятие";
    tabs.classList.add("hidden");
    form.reset();
    participants = [];
    renderParticipants();
  }

  switchTab("info");
}


  function closeEventModal() {
    document.getElementById("eventModal").classList.add("hidden");
    currentMode = "create";
    currentEventId = null;
  }

  window.switchTab = function (tab) {
    document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((content) => content.classList.add("hidden"));
    document.querySelector(`.tab[onclick*="${tab}"]`).classList.add("active");
    document.getElementById(`tab-${tab}`).classList.remove("hidden");
  };

  function collectFilterParams() {
    const params = new URLSearchParams();
    const title = document.getElementById("filterTitle").value.trim();
    const type = document.getElementById("filterType").value;
    const level = document.getElementById("filterLevel").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;

    if (title) params.append("title", title);
    if (type) params.append("type", type);
    if (level) params.append("level", level);
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);

    return params.toString();
  }

  async function submitEvent() {
    const title = document.getElementById("eventTitle").value.trim();
    const date = document.getElementById("eventDate").value;
    const location = document.getElementById("eventPlace").value.trim();
    const type = document.getElementById("eventType").value.trim();
    const lvl = document.getElementById("eventLevel").value.trim();
    const orderFile = document.getElementById("eventOrder").files[0];

    if (!title || !date) return alert("Заполните название и дату");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("date", date);
    formData.append("location", location);
    formData.append("type", type);
    formData.append("lvl", lvl);
    formData.append("organizerId", userId);
    if (orderFile) formData.append("orderFile", orderFile);

    try {
      const url = currentMode === "edit" ? `/api/events/${currentEventId}` : "/api/events";
      const method = currentMode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      if (res.ok) {
        closeEventModal();
        await loadEvents();
      } else {
        const errText = await res.text();
        alert("Ошибка сохранения: " + errText);
      }
    } catch (err) {
      console.error("Ошибка сохранения:", err);
    }
  }

  window.openAddStudent = async function () {
  await loadStudents();
  await initTeacherSelect();
  document.getElementById("addStudentModal").classList.remove("hidden");
};
async function loadStudents(groupFilter = null) {
  try {
    const url = groupFilter 
      ? `/api/students/filter?groupId=${groupFilter}`
      : '/api/students';
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("Ошибка загрузки");
    
    const students = await res.json();
    const select = document.getElementById('studentSelect');
    const currentValue = select.value; // Сохраняем текущее значение
    
    select.innerHTML = '<option value="">-- выберите студента --</option>';
    
    students.forEach(s => {
      const option = document.createElement('option');
      option.value = s.StudentId;
      option.textContent = `${s.FullName} (${s.GroupName})`;
      select.appendChild(option);
    });
    
    // Восстанавливаем выбранное значение
    if (currentValue) {
      select.value = currentValue;
    }
  } catch (err) {
    console.error("Ошибка:", err);
  }
}
async function initGroupFilter() {
  try {
    const res = await fetch('/api/groups');
    if (!res.ok) throw new Error("Ошибка загрузки групп");
    
    const groups = await res.json();
    const filter = document.getElementById('groupFilter');
    filter.innerHTML = '<option value="">Все группы</option>';
    
    groups.forEach(g => {
      const option = document.createElement('option');
      option.value = g.GroupId;
      option.textContent = g.GroupName;
      filter.appendChild(option);
    });
  } catch (err) {
    console.error("Ошибка загрузки групп:", err);
    alert("Не удалось загрузить список групп");
  }
}

// Вызываем при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  initGroupFilter(); // Добавляем эту строку
  loadEvents();
});

window.filterStudentsByGroup = function(groupId) {
  loadStudents(groupId); // Используем новый endpoint
};

// Вызови при загрузке:
document.addEventListener("DOMContentLoaded", () => {
  initGroupFilter();
  // ... остальной код инициализации
});

async function loadTeachers() {
  try {
    const res = await fetch('/api/teachers');
    if (!res.ok) throw new Error("Ошибка загрузки преподавателей");
    return await res.json();
  } catch (err) {
    console.error('Ошибка:', err);
    return [];
  }
}

async function initTeacherSelect() {
  const teachers = await loadTeachers();
  const select = document.getElementById('teacherSelect');
  select.innerHTML = '<option value="">-- выберите руководителя --</option>';
  
  teachers.forEach(teacher => {
    const option = document.createElement('option');
    option.value = teacher.UserId;
    option.textContent = teacher.FullName;
    select.appendChild(option);
  });
}

window.addStudentToList = async function () {
  const studentSelect = document.getElementById("studentSelect");
  const selectedOption = studentSelect.options[studentSelect.selectedIndex];
  const studentId = parseInt(studentSelect.value);
  const studentName = selectedOption?.text || "";

  if (!studentId) {
    alert("Выберите студента из списка");
    return;
  }

  // Проверка дубликата локально
  if (participants.find(p => p.studentId === studentId)) {
    alert("Этот студент уже добавлен");
    return;
  }

  // Отправляем на сервер
  const success = await sendParticipantToServer(currentEventId, studentId);
  if (!success) return;

  // После успешного добавления — загружаем участников с сервера
  await loadParticipants(currentEventId);

  closeAddStudent();
};


function closeAddStudent() {
  document.getElementById("addStudentModal").classList.add("hidden");
  document.getElementById("studentSelect").value = "";
  document.getElementById("studentSelect").disabled = false;
  document.getElementById("studentPlace").value = "";
  document.getElementById("studentCertificate").value = "";
}

//что то на заморском
async function sendParticipantToServer(eventId, studentId) {
  const place = document.getElementById("studentPlace").value;
  const teacherSelect = document.getElementById("teacherSelect");
  const teacherId = teacherSelect.value;
  const certFile = document.getElementById("studentCertificate").files[0];
  
  const formData = new FormData();
  formData.append("studentId", studentId);
  formData.append("placeTaken", place);
  formData.append("teacherId", teacherId);
  if (certFile) formData.append("certificate", certFile);

  try {
    const res = await fetch(`/api/events/${eventId}/participants`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const errorData = await res.json();
      // Игнорируем ошибку "Участник уже добавлен" при редактировании
      if (errorData.error === "Участник уже добавлен") {
        return true;
      }
      throw new Error(errorData.error || "Ошибка сервера");
    }
    return true;
  } catch (err) {
    console.error("Ошибка при добавлении участника:", err);
    alert("Ошибка: " + err.message);
    return false;
  }
}

async function loadParticipants(eventId) {
  try {
    const res = await fetch(`/api/events/${eventId}/participants`);
    participants = await res.json();
    console.log("Загруженные участники:", participants);
    renderParticipants();
  } catch (error) {
    console.error("Ошибка при загрузке участников:", error);
  }
}



function renderParticipants() {
  const tableBody = document.getElementById("studentsTableBody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  if (!participants || participants.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4">Участники не добавлены</td></tr>`;
    return;
  }

  participants.forEach((p, i) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.FullName || "Без имени"}(${p.GroupName || 'без группы'})</td>
      <td>${p.Place || ""}</td>
      <td>${p.TeacherName || "Не указан"}</td>
      <td>${p.CertificatePath ? `<a href="${p.CertificatePath}" target="_blank">Сертификат</a>` : ""}</td>
      <td>
        <button data-index="${i}" class="edit-student-btn">Редактировать</button>
        <button data-index="${i}" class="remove-student-btn">Удалить</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  // Обработчики кнопок редактирования
  tableBody.querySelectorAll(".edit-student-btn").forEach(btn =>
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      openEditStudentModal(participants[idx]);
    })
  );

  // Обработчики кнопок удаления
  tableBody.querySelectorAll(".remove-student-btn").forEach(btn =>
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.index);
      const participant = participants[idx];

      if (participant.EventParticipantId) {
        try {
          await removeParticipantFromServer(currentEventId, participant.EventParticipantId);
        } catch (err) {
          alert("Ошибка при удалении участника с сервера");
          return;
        }
      }

      participants.splice(idx, 1);
      renderParticipants();
    })
  );
}

function openEditStudentModal(participant) {
  // Загружаем список студентов ПЕРЕД открытием модалки
  loadStudents().then(() => {
    // Заполняем форму данными участника
    const studentSelect = document.getElementById("studentSelect");
    studentSelect.value = participant.StudentId;
    
    // Создаем временный option если студента нет в списке
    if (!studentSelect.querySelector(`option[value="${participant.StudentId}"]`)) {
      const option = document.createElement('option');
      option.value = participant.StudentId;
      option.textContent = `${participant.FullName} (${participant.GroupName})`;
      studentSelect.appendChild(option);
    }
    
    document.getElementById("studentPlace").value = participant.Place || "";
    
    // Настройка модалки
    const modal = document.getElementById("addStudentModal");
    modal.querySelector("h3").textContent = "Редактировать участника";
    
    const addBtn = document.getElementById("addStudentToListBtn");
    addBtn.textContent = "Сохранить";
    
    // Вешаем новый обработчик
    addBtn.onclick = async () => {
      const success = await updateParticipant(
        participant.EventParticipantId,
        document.getElementById("studentPlace").value,
        document.getElementById("studentCertificate").files[0]
      );
      if (success) closeAddStudent();
    };
    
    modal.classList.remove("hidden");
  });
}

async function updateParticipant(participantId, place, certificateFile) {
  const formData = new FormData();
  formData.append('Place', place);
  
  const teacherSelect = document.getElementById("teacherSelect");
  const teacherId = teacherSelect.value;
  formData.append('TeacherId', teacherId);

  if (certificateFile) {
    formData.append('CertificateFile', certificateFile);
  }

  try {
    const res = await fetch(`/api/participants/${participantId}`, {
      method: 'PUT',
      body: formData
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    return true;
  } catch (err) {
    console.error("Ошибка обновления участника:", err);
    alert("Ошибка обновления: " + err.message);
    return false;
  }
}



async function removeParticipantFromServer(eventId, participantId) {
  const res = await fetch(`/api/participants/${participantId}`, {
  method: "DELETE",
});
  if (!res.ok) {
    alert("Ошибка при удалении участника");
  }
}


// Обработчики кнопок
addEventBtn.addEventListener("click", () => openEventModal("create"));

applyFiltersBtn.addEventListener("click", () => {
const params = collectFilterParams();
loadEvents(params);
});

resetFiltersBtn.addEventListener("click", () => {
document.getElementById("filterTitle").value = "";
document.getElementById("filterType").value = "";
document.getElementById("filterLevel").value = "";
document.getElementById("dateFrom").value = "";
document.getElementById("dateTo").value = "";
loadEvents();
});

document.getElementById("saveEventBtn").addEventListener("click", submitEvent);
document.getElementById("cancelEventBtn").addEventListener("click", closeEventModal);
document.getElementById("closeAddStudentBtn").addEventListener("click", closeAddStudent);
document.getElementById("addStudentToListBtn").addEventListener("click", addStudentToList);
document.getElementById("closeEventBtnTop").addEventListener("click", closeEventModal);


loadEvents();
});