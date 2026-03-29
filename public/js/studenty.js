document.addEventListener("DOMContentLoaded", () => {
  const studentsList = document.getElementById("studentsList");
  const groupFilter = document.getElementById("groupFilter");
  const searchInput = document.getElementById("searchInput");
  let allStudents = [];

  // Инициализация
  loadGroups();
  loadAllStudents();

  // Загрузка всех студентов (один раз)
  async function loadAllStudents() {
    try {
      const res = await fetch('/api/students');
      allStudents = await res.json();
      applyFilters();
    } catch (err) {
      console.error("Ошибка загрузки студентов:", err);
    }
  }

  // Загрузка групп
  async function loadGroups() {
    try {
      const res = await fetch('/api/groups');
      const groups = await res.json();
      
      groupFilter.innerHTML = '<option value="">Все группы</option>';
      groups.forEach(g => {
        const option = document.createElement('option');
        option.value = g.GroupId;
        option.textContent = g.GroupName;
        groupFilter.appendChild(option);
      });
    } catch (err) {
      console.error("Ошибка загрузки групп:", err);
    }
  }

// Применение фильтров
  function applyFilters() {
    const groupId = groupFilter.value;
    const searchQuery = searchInput.value.trim().toLowerCase();

    const filtered = allStudents.filter(student => {
      const matchesGroup = !groupId || student.GroupId == groupId;
      const matchesSearch = !searchQuery || 
        student.FullName.toLowerCase().includes(searchQuery);
      return matchesGroup && matchesSearch;
    });

    renderStudents(filtered);
  }

  // Рендер студентов
  function renderStudents(students) {
    studentsList.innerHTML = students.length ? '' : '<p>Студентов не найдено</p>';
    
    students.forEach(student => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.innerHTML = `
        <h3>${student.FullName}</h3>
        <p>Группа: ${student.GroupName || 'Не указана'}</p>
        <button data-id="${student.StudentId}" data-name="${encodeURIComponent(student.FullName)}">
          Просмотреть мероприятия
        </button>
      `;
      studentsList.appendChild(card);
    });

    // Вешаем обработчики на новые кнопки
    document.querySelectorAll('.student-card button').forEach(btn => {
      btn.addEventListener('click', () => viewStudentEvents(
        btn.dataset.id,
        decodeURIComponent(btn.dataset.name)
      ));
    });
  }

  // Обработчики событий
  groupFilter.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);

  // Просмотр мероприятий студента
  window.viewStudentEvents = async (studentId, studentName) => {
    try {
      const res = await fetch(`/api/students/${studentId}/events`);
      const participations = await res.json();
      
      document.getElementById('studentModalTitle').textContent = 
        `Мероприятия студента: ${studentName}`;
      renderStudentEvents(participations);
      document.getElementById('studentEventsModal').classList.remove('hidden');
    } catch (err) {
      console.error("Ошибка загрузки мероприятий:", err);
      alert("Не удалось загрузить мероприятия");
    }
  };


  window.viewStudentEvents = async (studentId, studentName) => {
    currentStudentId = studentId;
    document.getElementById('studentModalTitle').textContent = 
      `Мероприятия студента: ${studentName}`;
    
    try {
      const res = await fetch(`/api/students/${studentId}/events`);
      const participations = await res.json();
      
      renderStudentEvents(participations);
      document.getElementById('studentEventsModal').classList.remove('hidden');
    } catch (err) {
      console.error("Ошибка загрузки мероприятий:", err);
      alert("Не удалось загрузить мероприятия");
    }
  };

  function renderStudentEvents(participations) {
    const tbody = document.getElementById('studentEventsBody');
    tbody.innerHTML = '';
    
    if (participations.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">Студент не участвовал в мероприятиях</td>
        </tr>
      `;
      return;
    }
    
    participations.forEach(participation => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${participation.EventTitle}</td>
        <td>${new Date(participation.Date).toLocaleDateString()}</td>
        <td>${participation.Place || '-'}</td>
        
        <td>
          ${participation.CertificatePath 
            ? `<a href="${participation.CertificatePath}" target="_blank">Скачать</a>` 
            : 'Нет'}
        </td>
        <td>
          <button onclick="openEditParticipationModal(
            ${participation.EventParticipantId},
            '${participation.Place || ''}'
          )">
            Редактировать
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.openEditParticipationModal = (participationId, currentPlace) => {
    currentParticipationId = participationId;
    document.getElementById('editPlace').value = currentPlace;
    document.getElementById('editCertificate').value = '';
    document.getElementById('editParticipationModal').classList.remove('hidden');
  };

  window.closeEditModal = () => {
    document.getElementById('editParticipationModal').classList.add('hidden');
  };

  window.saveParticipationChanges = async () => {
    const place = document.getElementById('editPlace').value;
    const certFile = document.getElementById('editCertificate').files[0];
    
    const formData = new FormData();
    formData.append('Place', place);
    if (certFile) formData.append('CertificateFile', certFile);
    
    try {
      const res = await fetch(`/api/participants/${currentParticipationId}`, {
        method: 'PUT',
        body: formData
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      closeEditModal();
      viewStudentEvents(currentStudentId, 
        document.getElementById('studentModalTitle').textContent.replace('Мероприятия студента: ', ''));
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      alert("Ошибка при сохранении изменений");
    }
  };

  window.closeStudentModal = () => {
    document.getElementById('studentEventsModal').classList.add('hidden');
  };
});