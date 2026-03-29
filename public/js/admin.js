// Переменные
const eventModal = document.getElementById('eventModal');
const eventForm = document.getElementById('eventForm');
const eventsTableBody = document.querySelector('#eventsTable tbody');
const addEventBtn = document.getElementById('addEventBtn');
const organizerSelect = document.getElementById('eventOrganizer');
let editingEventId = null;
let currentParticipantsEventId = null;

// ===== Открытие и закрытие модалки =====
addEventBtn.addEventListener('click', async () => {
    editingEventId = null;
    eventForm.reset();
    document.getElementById('modalTitle').textContent = 'Добавить мероприятие';
    await loadEventOrganizers();
    eventModal.style.display = 'block';
});

function closeModal() {
    eventModal.style.display = 'none';
}

// Закрытие по клику вне модального окна
window.addEventListener('click', (e) => {
    if (e.target === eventModal) {
        closeModal();
    }
});

// ===== Загрузка преподавателей =====
async function loadEventOrganizers() {
    try {
        const res = await fetch('/api/teachers');
        const data = await res.json();
        organizerSelect.innerHTML = '';
        data.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.UserId;
            option.textContent = teacher.FullName;
            organizerSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка при загрузке преподавателей:', err);
    }
}

const eventList = document.getElementById("eventList");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
applyFiltersBtn.addEventListener('click', applyFilters);


// ===== Загрузка мероприятий =====
async function loadAllEvents() {
    try {
        const res = await fetch('/api/events');
        const data = await res.json();
        renderEvents(data);
    } catch (err) {
        console.error('Ошибка при загрузке мероприятий:', err);
        eventList.innerHTML = '<p>Не удалось загрузить мероприятия.</p>';
    }
}

const loadEvents = loadAllEvents;


// Рендер списка мероприятий


// Применить фильтры
async function applyFilters() {
    const params = new URLSearchParams();

    const title = document.getElementById("filterTitle").value.trim();
    if (title) params.append('title', title);

    const type = document.getElementById("filterType").value;
    if (type) params.append('type', type);

    const level = document.getElementById("filterLevel").value;
    if (level) params.append('level', level);

    const dateFrom = document.getElementById("dateFrom").value;
    if (dateFrom) params.append('dateFrom', dateFrom);

    const dateTo = document.getElementById("dateTo").value;
    if (dateTo) params.append('dateTo', dateTo);

    try {
        const res = await fetch(`/api/events?${params.toString()}`);
        const events = await res.json();
        renderEvents(events);
    } catch (err) {
        alert("Ошибка при фильтрации мероприятий");
        console.error(err);
    }
}

// Сбросить фильтры
resetFiltersBtn.addEventListener('click', () => {
    document.getElementById("filterTitle").value = '';
    document.getElementById("filterType").value = '';
    document.getElementById("filterLevel").value = '';
    document.getElementById("dateFrom").value = '';
    document.getElementById("dateTo").value = '';

    loadAllEvents();
});
// ===== Добавление / редактирование мероприятия =====
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('title', document.getElementById('eventTitle').value);
    formData.append('type', document.getElementById('eventType').value);
    formData.append('date', document.getElementById('eventDate').value);
    formData.append('location', document.getElementById('eventLocation').value);
    formData.append('lvl', document.getElementById('eventLvl').value);
    formData.append('organizerId', document.getElementById('eventOrganizer').value);

    const orderFile = document.getElementById('orderFile').files[0];
    if (orderFile) formData.append('orderFile', orderFile);

    const url = editingEventId ? `/api/events/${editingEventId}` : '/api/events';
    const method = editingEventId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, { method, body: formData });
        if (response.ok) {
            closeModal();
            loadEvents();
        } else {
            const errText = await response.text();
            alert(`Ошибка при сохранении: ${errText}`);
        }
    } catch (err) {
        alert('Сервер не отвечает или произошла ошибка');
        console.error(err);
    }
});

// ===== Удаление мероприятия =====
async function deleteEvent(id) {
    if (confirm('Удалить мероприятие?')) {
        try {
            await fetch(`/api/events/${id}`, { method: 'DELETE' });
            loadEvents();
        } catch (err) {
            alert('Ошибка при удалении');
            console.error(err);
        }
    }
}

// ===== Редактирование мероприятия =====
async function editEvent(id) {
    try {
        const res = await fetch(`/api/events/${id}`);
        const event = await res.json();

        editingEventId = event.EventId;
        document.getElementById('eventTitle').value = event.Title;
        document.getElementById('eventType').value = event.Type;
        document.getElementById('eventDate').value = event.Date.slice(0, 10); // формат yyyy-mm-dd
        document.getElementById('eventLocation').value = event.Location;
        document.getElementById('eventLvl').value = event.Lvl;

        await loadEventOrganizers();
        document.getElementById('eventOrganizer').value = event.OrganizerId;

        document.getElementById('modalTitle').textContent = 'Редактировать мероприятие';
        eventModal.style.display = 'block';
    } catch (err) {
        alert('Ошибка при загрузке мероприятия');
        console.error(err);
    }
}

// часть логики для преподавателей
  let editingTeacherId = null;

  async function loadTeachers() {
    const res = await fetch('/api/teachers');
    const teachers = await res.json();

    const list = document.getElementById('teachers-list');
    list.innerHTML = '';

    teachers.forEach(teacher => {
      const div = document.createElement('div');
      div.className = 'teacher-card';
      div.style = 'border: 1px solid #999; border-radius: 6px; padding: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';

      div.innerHTML = `
        <div>
          <strong>${teacher.FullName}</strong><br>
          <small>ID: ${teacher.UserId}</small>
        </div>
        <div>
          <button onclick="editTeacher(${teacher.UserId}, '${teacher.FullName}', '${teacher.Login ?? ''}')">✏️</button>
          <button onclick="deleteTeacher(${teacher.UserId})">🗑️</button>
        </div>
      `;
      list.appendChild(div);
    });
  }

  function openTeacherForm() {
    document.getElementById('teacher-form').style.display = 'block';
    editingTeacherId = null;
    document.getElementById('teacher-id').value = '';
    document.getElementById('teacher-fullname').value = '';
    document.getElementById('teacher-login').value = '';
    document.getElementById('teacher-password').value = '';
  }

  function cancelTeacherForm() {
    document.getElementById('teacher-form').style.display = 'none';
  }

  async function saveTeacher() {
    const id = editingTeacherId;
    const fullName = document.getElementById('teacher-fullname').value;
    const login = document.getElementById('teacher-login').value;
    const password = document.getElementById('teacher-password').value;

    const payload = { fullName, login, password };

    if (id) {
      await fetch(`/api/teachers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    cancelTeacherForm();
    loadTeachers();
  }

  function editTeacher(id, fullName, login) {
    editingTeacherId = id;
    document.getElementById('teacher-form').style.display = 'block';
    document.getElementById('teacher-fullname').value = fullName;
    document.getElementById('teacher-login').value = login;
    document.getElementById('teacher-password').value = '';
  }

  async function deleteTeacher(id) {
    if (confirm('Удалить преподавателя?')) {
      await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
      loadTeachers();
    }
  }

//логика для студентов
async function loadStudents() {
  const res = await fetch('/api/students');
  const students = await res.json();

  const search = document.getElementById('student-search').value.toLowerCase();
  const selectedGroup = document.getElementById('group-filter').value;

  const filtered = students.filter(s => {
    return (!selectedGroup || s.GroupName === selectedGroup) &&
           (!search || s.FullName.toLowerCase().includes(search));
  });

  const list = document.getElementById('students-list');
  list.innerHTML = '';

  filtered.forEach(student => {
    const div = document.createElement('div');
    div.className = 'student-item';
      div.innerHTML = `
        <strong class="student-name">${student.FullName}</strong> (<span class="student-group">${student.GroupName || 'Без группы'}</span>)<br>
        ${student.Certificates.map(c => `
          <div style="margin-left:10px;">
            ▪ ${c.EventName} — <a href="${c.FilePath}" target="_blank">Сертификат</a>
          </div>
        `).join('')}
        <button class="edit-btn" data-id="${student.StudentId}">Редактировать</button>
        <button class="delete-btn" data-id="${student.StudentId}" style="margin-left:10px; color: red;">Удалить</button>
      `;
    list.appendChild(div);
  });
}

document.getElementById('student-search').addEventListener('input', loadStudents);
document.getElementById('group-filter').addEventListener('change', loadStudents);

// Загрузка списка групп для фильтра
async function loadGroupsForFilter() {
  const res = await fetch('/api/groups');
  const groups = await res.json();
  const filter = document.getElementById('group-filter');
  groups.forEach(g => {
    const option = document.createElement('option');
    option.value = g.GroupName;
    option.textContent = g.GroupName;
    filter.appendChild(option);
  });
}

async function loadGroupsForSelect() {
  const res = await fetch('/api/groups');
  const groups = await res.json();
  const select = document.getElementById('groupSelect');
  groups.forEach(g => {
    const option = document.createElement('option');
    option.value = g.GroupId;
    option.textContent = g.GroupName;
    select.appendChild(option);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadGroupsForFilter();
  loadGroupsForSelect();
  loadStudents();
});

document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    FullName: form.FullName.value,
    GroupId: form.GroupId.value
  };

  const res = await fetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message);
  form.reset();
  loadStudents();
});

document.getElementById('excelUploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const res = await fetch('/api/students/upload', {
    method: 'POST',
    body: formData
  });

  const result = await res.json();
  alert(result.message);
  loadStudents();
});

// ===== Удаление студента =====
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    if (confirm('Удалить этого студента?')) {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      const result = await res.json();
      alert(result.message);
      loadStudents();
    }
  }
});

// ===== Открытие модалки редактирования =====
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('edit-btn')) {
    const id = e.target.dataset.id;
    const res = await fetch(`/api/students/${id}`);
    const student = await res.json();

    const form = document.getElementById('editStudentForm');
    form.StudentId.value = student.StudentId;
    form.FullName.value = student.FullName;
    document.getElementById('editGroupSelect').innerHTML = '';

    const groupsRes = await fetch('/api/groups');
    const groups = await groupsRes.json();
    groups.forEach(g => {
      const option = document.createElement('option');
      option.value = g.GroupId;
      option.textContent = g.GroupName;
      if (g.GroupId === student.GroupId) option.selected = true;
      document.getElementById('editGroupSelect').appendChild(option);
    });

    document.getElementById('editStudentModal').style.display = 'block';
  }
});

// ===== Закрытие модалки редактирования =====
document.getElementById('closeEditModal').addEventListener('click', () => {
  document.getElementById('editStudentModal').style.display = 'none';
});

// ===== Сохранение изменений при редактировании =====
document.getElementById('editStudentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.StudentId.value;
  const data = {
    FullName: form.FullName.value,
    GroupId: form.GroupId.value
  };

  const res = await fetch(`/api/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message);
  document.getElementById('editStudentModal').style.display = 'none';
  loadStudents();
});



// логика для групп
let editingGroupId = null;

async function loadGroups() {
  const res = await fetch('/api/groups');
  const groups = await res.json();
  const list = document.getElementById('groups-list');
  list.innerHTML = '';
  groups.forEach(group => {
    const div = document.createElement('div');
    div.innerHTML = `
      <b>${group.GroupName}</b>
      <button onclick="editGroup(${group.GroupId}, '${group.GroupName}')">✏️</button>
      <button onclick="deleteGroup(${group.GroupId})">🗑️</button>
    `;
    list.appendChild(div);
  });
}

function openGroupForm() {
  editingGroupId = null;
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-form').style.display = 'block';
}

function closeGroupForm() {
  editingGroupId = null;
  document.getElementById('group-form').style.display = 'none';
}

function editGroup(id, name) {
  editingGroupId = id;
  document.getElementById('group-name-input').value = name;
  document.getElementById('group-form').style.display = 'block';
}

async function saveGroup() {
  const name = document.getElementById('group-name-input').value.trim();
  if (!name) return alert('Введите название группы');

  if (editingGroupId) {
    await fetch(`/api/groups/${editingGroupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ GroupName: name })
    });
  } else {
    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ GroupName: name })
    });
  }

  closeGroupForm();
  loadGroups();
}

async function deleteGroup(id) {
  if (confirm('Удалить эту группу?')) {
    await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    loadGroups();
  }
}

// Новая функция для загрузки участников любого мероприятия
async function loadEventParticipants(eventId) {
  currentParticipantsEventId = eventId;
  try {
    const res = await fetch(`/api/events/${eventId}/participants`);
    const participants = await res.json();
    
    // Открываем модалку с участниками
    const modal = document.getElementById('participantsModal');
    const tbody = modal.querySelector('tbody');
    tbody.innerHTML = participants.map(p => `
      <tr>
        <td>${p.FullName}</td>
        <td>${p.GroupName}</td>
        <td>${p.Place || '-'}</td>
        <td>${p.TeacherName || "Не указан"}</td>
        <td>${p.CertificatePath ? `<a href="${p.CertificatePath}" target="_blank">Скачать</a>` : 'Нет'}</td>
      </tr>
    `).join('');
    
    modal.style.display = 'block';
  } catch (err) {
    console.error('Ошибка:', err);
    alert('Не удалось загрузить участников');
  }
}

async function exportParticipants() {
  if (!currentParticipantsEventId) return;
  
  try {
    window.open(`/api/events/${currentParticipantsEventId}/participants/export`);
  } catch (err) {
    console.error('Ошибка экспорта:', err);
    alert('Ошибка при экспорте');
  }
}

function closeParticipantsModal() {
  document.getElementById('participantsModal').style.display = 'none';
}


async function exportMultipleEvents() {
  // Получаем выбранные мероприятия
  const checkboxes = document.querySelectorAll('.event-checkbox:checked');
  if (checkboxes.length === 0) {
    return alert('Выберите хотя бы одно мероприятие');
  }

  const eventIds = Array.from(checkboxes).map(cb => cb.value).join(',');
  
  // Формируем URL и скачиваем
  window.open(`/api/reports/participants/multi-export?eventIds=${eventIds}`);
}

// Добавляем чекбоксы в рендер мероприятий
function renderEvents(events) {
    eventList.innerHTML = "";

    if (events.length === 0) {
        eventList.innerHTML = "<p>Мероприятий не найдено.</p>";
        return;
    }

    events.forEach(event => {
        const div = document.createElement("div");
        div.className = "event-card";
        div.style.border = "1px solid #ddd";
        div.style.padding = "10px";
        div.style.marginBottom = "10px";
        div.style.borderRadius = "4px";
        div.style.backgroundColor = "#fafafa";

        div.innerHTML = `
            <label style="display: block; margin-bottom: 5px;">
              <input type="checkbox" class="event-checkbox" value="${event.EventId}">
              <strong>${event.Title}</strong>
            </label>
            <p><strong>Тип:</strong> ${event.Type}</p>
            <p><strong>Уровень:</strong> ${event.Lvl}</p>
            <p><strong>Дата:</strong> ${new Date(event.Date).toLocaleDateString()}</p>
            <p><strong>Место:</strong> ${event.Location}</p>
            <p><strong>Организатор:</strong> ${event.OrganizerName}</p>
            ${event.OrderFilePath ? `<p><a href="${event.OrderFilePath}" target="_blank">Скачать приказ</a></p>` : ""}
            <button onclick="editEvent(${event.EventId})">✏️ Редактировать</button>
            <button onclick="deleteEvent(${event.EventId})">🗑️ Удалить</button>
            <button onclick="loadEventParticipants(${event.EventId})">👥 Участники</button>
        `;

        eventList.appendChild(div);
    });
}

document.addEventListener('DOMContentLoaded', loadGroups);

  // Загрузка при открытии страницы
  window.addEventListener('DOMContentLoaded', loadTeachers);

// ====================== АВТОГЕНЕРАЦИЯ ЛОГИНА ПРЕПОДАВАТЕЛЯ ======================
function generateTeacherLogin() {
  const fullName = document.getElementById('teacher-fullname').value.trim();
  if (!fullName) {
    alert('Сначала введите ФИО преподавателя!');
    return;
  }
  const parts = fullName.split(/\s+/).filter(Boolean);
  let login = parts[0].toLowerCase();                    // фамилия
  if (parts.length > 1) login += '.' + parts[1][0].toLowerCase();
  if (parts.length > 2) login += parts[2][0].toLowerCase();
  document.getElementById('teacher-login').value = login;
}

// ====================== СТАТИСТИКА ПО ВЫБРАННЫМ ======================
async function calculateSelectedStats() {
  const checkboxes = document.querySelectorAll('.event-checkbox:checked');
  if (checkboxes.length === 0) return alert('Выберите хотя бы одно мероприятие');

  const eventIds = Array.from(checkboxes).map(cb => cb.value).join(',');

  try {
    const res = await fetch(`/api/reports/participants/multi-stats?eventIds=${eventIds}`);
    if (!res.ok) throw new Error('Ошибка сервера');
    const stats = await res.json();

    const content = document.getElementById('statsContent');
    content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px;">
        <div style="background:#f0f0f0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:2em; font-weight:bold;">${stats.totalEvents}</div>
          <div>Мероприятий</div>
        </div>
        <div style="background:#f0f0f0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:2em; font-weight:bold;">${stats.totalParticipations}</div>
          <div>Участий всего</div>
        </div>
        <div style="background:#f0f0f0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:2em; font-weight:bold;">${stats.uniqueStudents}</div>
          <div>Уникальных студентов</div>
        </div>
        <div style="background:#f0f0f0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:2em; font-weight:bold;">${stats.certificatesIssued}</div>
          <div>Сертификатов</div>
        </div>
        <div style="background:#f0f0f0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:2em; font-weight:bold;">${stats.avgParticipantsPerEvent}</div>
          <div>Среднее на мероприятие</div>
        </div>
        <div style="background:#f0f0f0; padding:15px; border-radius:8px; text-align:center;">
          <div style="font-size:2em; font-weight:bold;">${stats.uniqueOrganizers}</div>
          <div>Руководителей</div>
        </div>
      </div>

      <h4>Топ-5 групп по участиям</h4>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#ddd;"><th style="padding:8px; text-align:left;">Группа</th><th style="padding:8px; text-align:right;">Участий</th></tr>
        </thead>
        <tbody>
          ${stats.topGroups.map(g => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #ddd;">${g.groupName}</td>
              <td style="padding:8px; text-align:right; border-bottom:1px solid #ddd;">${g.count}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('statsModal').style.display = 'block';
  } catch (err) {
    console.error(err);
    alert('Не удалось посчитать статистику');
  }
}

function closeStatsModal() {
  document.getElementById('statsModal').style.display = 'none';
}
// ===== Первичная загрузка =====
loadEvents();
