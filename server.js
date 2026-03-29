const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const ExcelJS = require('exceljs');


const app = express();
const PORT = 3000;

const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'frontend', 'index.html'));
});

// Папка для приказов
const orderStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/orders'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage: orderStorage });

const certStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/certification'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const uploadCert = multer({ storage: certStorage });

app.use('/uploads/certification', express.static(path.join(__dirname, 'uploads/certification')));

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());

// Конфигурация подключения к БД
const dbConfig = {
    user: 'college_app',
    password: 'college123',
    server: '127.0.0.1',
    port: 1433,
    database: 'Meropriyatiya',
    options: {
        encrypt: false,
        enableArithAbort: true
    }
};
const poolPromise = sql.connect(dbConfig);

// 🚪 Вход в систему
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;

    try {
        await sql.connect(dbConfig);
        const result = await sql.query`
            SELECT * FROM Users
            WHERE Login = ${login} AND PasswordHash = ${password}
        `;

        if (result.recordset.length === 1) {
            const user = result.recordset[0];
            res.json({
                success: true,
                userId: user.UserId,
                role: user.Role,
                fullName: user.FullName
            });
        } else {
            res.json({ success: false, message: "Неверный логин или пароль" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Ошибка сервера");
    }
});
// получение всех мероприятий с фильтрами и без
app.get('/api/events', async (req, res) => {
  const { title, type, level, dateFrom, dateTo } = req.query;

  let whereClauses = [];
  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();

    if (title) {
      request.input('title', sql.NVarChar, `%${title}%`);
      whereClauses.push(`e.Title LIKE @title`);
    }
    if (type) {
      request.input('type', sql.NVarChar, type);
      whereClauses.push(`e.Type = @type`);
    }
    if (level) {
      request.input('level', sql.NVarChar, level);
      whereClauses.push(`e.Lvl = @level`);
    }
    if (dateFrom) {
      request.input('dateFrom', sql.Date, dateFrom);
      whereClauses.push(`e.Date >= @dateFrom`);
    }
    if (dateTo) {
      request.input('dateTo', sql.Date, dateTo);
      whereClauses.push(`e.Date <= @dateTo`);
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const result = await request.query(`
      SELECT e.*, u.FullName AS OrganizerName
      FROM Events e
      LEFT JOIN Users u ON e.OrganizerId = u.UserId
      ${whereSQL}
      ORDER BY e.Date DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка при получении мероприятий:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// добавить новое мероприятие
app.post('/api/events', upload.single('orderFile'), async (req, res) => {
  const { title, type, date, location, lvl, organizerId } = req.body;
  const orderFilePath = req.file ? `/uploads/orders/${req.file.filename}` : null;

  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('Title', sql.NVarChar, title);
    request.input('Type', sql.NVarChar, type);
    request.input('Date', sql.Date, date);
    request.input('Location', sql.NVarChar, location);
    request.input('OrganizerId', sql.Int, organizerId);
    request.input('OrderFilePath', sql.NVarChar, orderFilePath);
    request.input('Lvl', sql.NVarChar, lvl);

    await request.query(`
      INSERT INTO Events (Title, Type, Date, Location, OrganizerId, OrderFilePath, Lvl)
      VALUES (@Title, @Type, @Date, @Location, @OrganizerId, @OrderFilePath, @Lvl)
    `);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при добавлении мероприятия:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// редактировать мероприятие
app.put('/api/events/:id', upload.single('orderFile'), async (req, res) => {
  const eventId = req.params.id;
  const { title, type, date, location, lvl, organizerId } = req.body;
  const orderFilePath = req.file ? `/uploads/orders/${req.file.filename}` : null;

  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('Title', sql.NVarChar, title);
    request.input('Type', sql.NVarChar, type);
    request.input('Date', sql.Date, date);
    request.input('Location', sql.NVarChar, location);
    request.input('OrganizerId', sql.Int, organizerId);
    request.input('Lvl', sql.NVarChar, lvl);
    request.input('EventId', sql.Int, eventId);
    if (orderFilePath) {
      request.input('OrderFilePath', sql.NVarChar, orderFilePath);
    }

    let query = `
      UPDATE Events SET
        Title = @Title,
        Type = @Type,
        Date = @Date,
        Location = @Location,
        OrganizerId = @OrganizerId,
        Lvl = @Lvl
    `;

    if (orderFilePath) {
      query += `, OrderFilePath = @OrderFilePath `;
    }

    query += ` WHERE EventId = @EventId`;

    await request.query(query);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при редактировании мероприятия:', err);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;
  try {
    await sql.connect(dbConfig);
    const result = await sql.query`
      SELECT * FROM Events WHERE EventId = ${eventId}
    `;
    if (result.recordset.length === 1) {
      res.json(result.recordset[0]);
    } else {
      res.status(404).send('Мероприятие не найдено');
    }
  } catch (err) {
    console.error('Ошибка при получении мероприятия:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// удалить мероприятие
app.delete('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;

  try {
    await sql.connect(dbConfig);
    await sql.query(`DELETE FROM Events WHERE EventId = ${eventId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при удалении мероприятия:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// роут на получение всех преподавателей
app.get('/api/teachers', async (req, res) => {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query(`
      SELECT UserId, FullName
      FROM Users
      WHERE Role = 'teacher'
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка при получении преподавателей:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// добавление преподавателей
app.post('/api/teachers', async (req, res) => {
  const { fullName, login, password } = req.body;

  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('FullName', sql.NVarChar, fullName);
    request.input('Login', sql.NVarChar, login);
    request.input('Password', sql.NVarChar, password);
    request.input('Role', sql.NVarChar, 'teacher');

    await request.query(`
      INSERT INTO Users (FullName, Login, PasswordHash, Role)
      VALUES (@FullName, @Login, @Password, @Role)
    `);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при добавлении преподавателя:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// редактирование преподавателей
app.put('/api/teachers/:id', async (req, res) => {
  const teacherId = req.params.id;
  const { fullName, login, password } = req.body;

  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('UserId', sql.Int, teacherId);
    request.input('FullName', sql.NVarChar, fullName);
    request.input('Login', sql.NVarChar, login);
    request.input('Password', sql.NVarChar, password);

    await request.query(`
      UPDATE Users
      SET FullName = @FullName,
          Login = @Login,
          PasswordHash = @Password
      WHERE UserId = @UserId AND Role = 'teacher'
    `);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при редактировании преподавателя:', err);
    res.status(500).send('Ошибка сервера');
  }
});

//удаление преподавателей
app.delete('/api/teachers/:id', async (req, res) => {
  const teacherId = req.params.id;

  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('UserId', sql.Int, teacherId);

    await request.query(`
      DELETE FROM Users
      WHERE UserId = @UserId AND Role = 'teacher'
    `);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при удалении преподавателя:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Получить все группы
app.get('/api/groups', async (req, res) => {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query(`SELECT GroupId, GroupName FROM Groups`);
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка при получении групп:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Добавить новую группу
app.post('/api/groups', async (req, res) => {
  const { GroupName } = req.body;
  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('GroupName', sql.NVarChar, GroupName);
    await request.query(`INSERT INTO Groups (GroupName) VALUES (@GroupName)`);
    res.status(201).send('Группа добавлена');
  } catch (err) {
    console.error('Ошибка при добавлении группы:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Обновить название группы
app.put('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  const { GroupName } = req.body;
  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('GroupId', sql.Int, id);
    request.input('GroupName', sql.NVarChar, GroupName);
    await request.query(`
      UPDATE Groups SET GroupName = @GroupName WHERE GroupId = @GroupId
    `);
    res.send('Группа обновлена');
  } catch (err) {
    console.error('Ошибка при обновлении группы:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Удалить группу
app.delete('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('GroupId', sql.Int, id);
    await request.query(`DELETE FROM Groups WHERE GroupId = @GroupId`);
    res.send('Группа удалена');
  } catch (err) {
    console.error('Ошибка при удалении группы:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// /api/students — получить список студентов с группой и сертификатами
app.get('/api/students', async (req, res) => {
  try {
    await sql.connect(dbConfig);

    const result = await sql.query(`
      SELECT 
        s.StudentId,
        s.FullName,
        s.GroupId,
        g.GroupName,
        cert.CertificateId,
        cert.FilePath,
        e.Title AS EventTitle
      FROM Students s
      LEFT JOIN Groups g ON s.GroupId = g.GroupId
      LEFT JOIN Certificates cert ON cert.StudentId = s.StudentId
      LEFT JOIN Events e ON cert.EventId = e.EventId
      ORDER BY s.FullName
    `);
    

    // Можно сгруппировать по студентам, чтобы собрать сертификаты в массив
    const studentsMap = new Map();

    result.recordset.forEach(row => {
      if (!studentsMap.has(row.StudentId)) {
        studentsMap.set(row.StudentId, {
          StudentId: row.StudentId,
          FullName: row.FullName,
          GroupId: row.GroupId,
          GroupName: row.GroupName,
          Certificates: []
        });
      }
      if (row.CertificateId) {
        studentsMap.get(row.StudentId).Certificates.push({
          CertificateId: row.CertificateId,
          FilePath: row.FilePath,
          EventTitle: row.EventTitle
        });
      }
    });

    res.json(Array.from(studentsMap.values()));

  } catch (err) {
    console.error('Ошибка при получении студентов:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Фильтрация студентов по группам (без влияния на /api/students)
app.get('/api/students/filter', async (req, res) => {
  const { groupId } = req.query;
  try {
    const result = await sql.query`
      SELECT s.StudentId, s.FullName, g.GroupName
      FROM Students s
      JOIN Groups g ON s.GroupId = g.GroupId
      WHERE g.GroupId = ${parseInt(groupId)}
      ORDER BY s.FullName
    `;
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка фильтрации:', err);
    res.status(500).send('Ошибка сервера');
  }
});


// Получение одного студента по ID
app.get('/api/students/:id', async (req, res) => {
  const studentId = parseInt(req.params.id);
  

  if (isNaN(studentId)) {
    return res.status(400).json({ message: 'Некорректный ID студента' });
  }

  try {
    const pool = await poolPromise;

    const result = await pool.request()
      .input('StudentId', sql.Int, studentId)
      .query(`
        SELECT s.StudentId, s.FullName, s.GroupId, g.GroupName
        FROM Students s
        LEFT JOIN Groups g ON s.GroupId = g.GroupId
        WHERE s.StudentId = @StudentId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Ошибка при получении студента:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});



// POST /api/students — добавить нового студента
app.post('/api/students', async (req, res) => {
  try {
    const { FullName, GroupId } = req.body;

    if (!FullName || !GroupId) {
      return res.status(400).json({ message: 'ФИО и группа обязательны' });
    }

    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('FullName', sql.NVarChar, FullName);
    request.input('GroupId', sql.Int, GroupId);
    await request.query(`
      INSERT INTO Students (FullName, GroupId)
      VALUES (@FullName, @GroupId)
    `);


    res.status(201).json({ message: 'Студент успешно добавлен' });
  } catch (err) {
    console.error('Ошибка при добавлении студента:', err);
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/api/students/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    await sql.connect(dbConfig);

    for (const row of data) {
      const fullName = row.FullName?.trim();
      const groupName = row.GroupName?.trim();

      if (!fullName || !groupName) continue;

      // Получаем GroupId по названию
      const groupResult = await sql.query`
        SELECT GroupId FROM Groups WHERE GroupName = ${groupName}
      `;
      const groupId = groupResult.recordset[0]?.GroupId;

      if (!groupId) continue;

      // Вставляем студента
      await sql.query`
        INSERT INTO Students (FullName, GroupId)
        VALUES (${fullName}, ${groupId})
      `;
    }

    fs.unlinkSync(req.file.path); // Удаляем файл после обработки

    res.status(200).json({ message: 'Студенты успешно загружены' });
  } catch (err) {
    console.error('Ошибка при загрузке Excel:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// PUT /api/students/:id — редактирование студента
app.put('/api/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const { FullName, GroupId } = req.body;

    if (!FullName || !GroupId) {
      return res.status(400).json({ message: 'ФИО и группа обязательны' });
    }

    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('StudentId', sql.Int, studentId);
    request.input('FullName', sql.NVarChar, FullName);
    request.input('GroupId', sql.Int, GroupId);

    const result = await request.query(`
      UPDATE Students
      SET FullName = @FullName, GroupId = @GroupId
      WHERE StudentId = @StudentId
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    res.json({ message: 'Студент успешно обновлен' });
  } catch (err) {
    console.error('Ошибка при обновлении студента:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// DELETE /api/students/:id — удаление студента
app.delete('/api/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id;

    await sql.connect(dbConfig);
    const request = new sql.Request();
    request.input('StudentId', sql.Int, studentId);

    const result = await request.query(`
      DELETE FROM Students WHERE StudentId = @StudentId
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Студент не найден' });
    }

    res.json({ message: 'Студент успешно удален' });
  } catch (err) {
    console.error('Ошибка при удалении студента:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Получить участников мероприятия
app.get('/api/events/:eventId/participants', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const request = new sql.Request();
    request.input('EventId', sql.Int, eventId);
    
    const result = await request.query(`
      SELECT 
        ep.Id AS EventParticipantId,
        s.StudentId,
        s.FullName AS FullName,
        g.GroupName,
        ep.Place,
        c.CertificateId,
        c.FilePath AS CertificatePath,
        u.UserId AS TeacherId,
        u.FullName AS TeacherName
      FROM EventParticipants ep
      JOIN Students s ON ep.StudentId = s.StudentId
      LEFT JOIN Groups g ON s.GroupId = g.GroupId
      LEFT JOIN Certificates c ON c.EventId = ep.EventId AND c.StudentId = s.StudentId
      LEFT JOIN Users u ON ep.TeacherId = u.UserId
      WHERE ep.EventId = @EventId
    `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка при получении участников:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// Добавить участника
app.post('/api/events/:eventId/participants', uploadCert.single('certificate'), async (req, res) => {
  const { eventId } = req.params;
  const { studentId, placeTaken, teacherId } = req.body;
  const certPath = req.file ? `/uploads/certification/${req.file.filename}` : null;
  
  try {
    await sql.connect(dbConfig);
    
    // Проверка существующего участника
    const checkRequest = new sql.Request();
    checkRequest.input('EventId', sql.Int, eventId);
    checkRequest.input('StudentId', sql.Int, studentId);
    
    const existing = await checkRequest.query(`
      SELECT Id FROM EventParticipants 
      WHERE EventId = @EventId AND StudentId = @StudentId
    `);
    
    if (existing.recordset.length > 0) {
      return res.status(400).json({ 
        error: "Участник уже добавлен",
        participantId: existing.recordset[0].Id
      });
    }
    
    const request = new sql.Request();
    request.input('EventId', sql.Int, eventId);
    request.input('StudentId', sql.Int, studentId);
    request.input('PlaceTaken', sql.NVarChar, placeTaken);
    request.input('TeacherId', sql.Int, teacherId);

    const insertResult = await request.query(`
      INSERT INTO EventParticipants (EventId, StudentId, Place, TeacherId)
      OUTPUT INSERTED.Id AS EventParticipantId
      VALUES (@EventId, @StudentId, @PlaceTaken, @TeacherId)
    `);

    const eventParticipantId = insertResult.recordset[0].EventParticipantId;

    if (certPath) {
      const certReq = new sql.Request();
      certReq.input('EventId', sql.Int, eventId);
      certReq.input('StudentId', sql.Int, studentId);
      certReq.input('FilePath', sql.NVarChar, certPath);
      await certReq.query(`
        INSERT INTO Certificates (EventId, StudentId, FilePath)
        VALUES (@EventId, @StudentId, @FilePath)
      `);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при добавлении участника:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Удалить участника
app.delete('/api/participants/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await sql.connect(dbConfig);
    
    // 1) Проверяем, есть ли такой участник
    const request = new sql.Request();
    request.input('EventParticipantId', sql.Int, id);
    const resParticipant = await request.query(`
      SELECT EventId, StudentId FROM EventParticipants WHERE Id = @EventParticipantId
    `);

    if (resParticipant.recordset.length === 0) {
      return res.status(404).json({ error: 'Участник не найден' });
    }

    const { EventId, StudentId } = resParticipant.recordset[0];

    // 2) Удаляем сертификат(ы), связанные с этим участником
    const delCertReq = new sql.Request();
    delCertReq.input('EventId', sql.Int, EventId);
    delCertReq.input('StudentId', sql.Int, StudentId);
    await delCertReq.query(`DELETE FROM Certificates WHERE EventId = @EventId AND StudentId = @StudentId`);

    // 3) Удаляем участника
    await request.query(`DELETE FROM EventParticipants WHERE Id = @EventParticipantId`);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при удалении участника:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Редактирование участника
app.put('/api/participants/:id', uploadCert.single('CertificateFile'), async (req, res) => {
  const { id } = req.params;
  const { Place, TeacherId } = req.body;

  try {
    await sql.connect(dbConfig);

    // Обновляем EventParticipants
    const request = new sql.Request();
    request.input('EventParticipantId', sql.Int, id);
    request.input('Place', sql.NVarChar(50), Place);
    request.input('TeacherId', sql.Int, TeacherId);

    await request.query(`
      UPDATE EventParticipants 
      SET Place = @Place, TeacherId = @TeacherId
      WHERE Id = @EventParticipantId
    `);

    // Обработка сертификата
    if (req.file) {
      const certPath = `/uploads/certification/${req.file.filename}`;

      // Получаем EventId и StudentId по участнику
      const fetchReq = new sql.Request();
      fetchReq.input('EventParticipantId', sql.Int, id);

      const participantRes = await fetchReq.query(`
        SELECT EventId, StudentId FROM EventParticipants 
        WHERE Id = @EventParticipantId
      `);

      if (participantRes.recordset.length > 0) {
        const { EventId, StudentId } = participantRes.recordset[0];

        const certReq = new sql.Request();
        certReq.input('EventId', sql.Int, EventId);
        certReq.input('StudentId', sql.Int, StudentId);
        certReq.input('FilePath', sql.NVarChar(255), certPath);

        await certReq.query(`
          IF EXISTS (
            SELECT 1 FROM Certificates 
            WHERE EventId = @EventId AND StudentId = @StudentId
          )
            UPDATE Certificates 
            SET FilePath = @FilePath
            WHERE EventId = @EventId AND StudentId = @StudentId
          ELSE
            INSERT INTO Certificates (EventId, StudentId, FilePath)
            VALUES (@EventId, @StudentId, @FilePath)
        `);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка при обновлении:', err);
    res.status(500).send('Ошибка сервера');
  }
});


// для страницы студентов
// Получение мероприятий студента
app.get('/api/students/:id/events', async (req, res) => {
  const studentId = req.params.id;
  
  try {
    const result = await sql.query`
      SELECT 
        ep.Id AS EventParticipantId,
        e.Title AS EventTitle,
        e.Date,
        ep.Place,
        c.FilePath AS CertificatePath
      FROM EventParticipants ep
      JOIN Events e ON ep.EventId = e.EventId
      LEFT JOIN Certificates c ON c.EventId = e.EventId AND c.StudentId = ep.StudentId
      WHERE ep.StudentId = ${studentId}
      ORDER BY e.Date DESC
    `;
    
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Добавляем новый endpoint для фильтрации
app.get('/api/students/filter', async (req, res) => {
  const { group, search } = req.query;

  try {
    let query = `
      SELECT s.StudentId, s.FullName, g.GroupId, g.GroupName 
      FROM Students s
      LEFT JOIN Groups g ON s.GroupId = g.GroupId
      WHERE 1=1
    `;

    if (group) query += ` AND s.GroupId = ${parseInt(group)}`;
    if (search) query += ` AND s.FullName LIKE '%${search.replace(/'/g, "''")}%'`;

    const result = await sql.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Ошибка фильтрации:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Статистика по мероприятиям
app.get('/api/events/stats', async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT 
        COUNT(*) as totalEvents,
        COUNT(DISTINCT OrganizerId) as uniqueOrganizers,
        (SELECT COUNT(*) FROM EventParticipants) as totalParticipants
      FROM Events
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Ошибка:', err);
    res.status(500).send('Ошибка сервера');
  }
});

// Экспорт участников в Excel
app.get('/api/events/:id/participants/export', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql.query(`
      SELECT 
        s.FullName AS StudentName,
        g.GroupName,
        ep.Place,
        e.Title AS EventTitle,
        u.FullName AS TeacherName
      FROM EventParticipants ep
      JOIN Students s ON ep.StudentId = s.StudentId
      LEFT JOIN Groups g ON s.GroupId = g.GroupId
      JOIN Events e ON ep.EventId = e.EventId
      LEFT JOIN Certificates c ON c.EventId = ep.EventId AND c.StudentId = s.StudentId
      LEFT JOIN Users u ON ep.TeacherId = u.UserId
      WHERE ep.EventId = ${id}
    `);

    // Создаем Excel файл
    const ws = xlsx.utils.json_to_sheet(result.recordset);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Участники");

    // Генерируем бинарные данные
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=participants_${id}.xlsx`);
    res.end(buffer);

  } catch (err) {
    console.error('Ошибка экспорта:', err);
    res.status(500).send('Ошибка экспорта');
  }
});


// Новый endpoint для экспорта участников нескольких мероприятий
app.get('/api/reports/participants/multi-export', async (req, res) => {
  try {
    const eventIds = req.query.eventIds.split(',').map(id => parseInt(id));
    
    if (!eventIds || eventIds.length === 0) {
      return res.status(400).json({ error: "Не указаны ID мероприятий" });
    }

    const request = new sql.Request();
    
    // Добавляем параметры ДО выполнения запроса
    eventIds.forEach((id, i) => {
      request.input(`eventId${i}`, sql.Int, id);
    });

    // Формируем часть SQL с параметрами
    const paramsPlaceholders = eventIds.map((_, i) => `@eventId${i}`).join(',');
    
    const result = await request.query(`
      SELECT 
        e.Title AS EventTitle,
        e.Date AS EventDate,
        s.FullName AS StudentName,
        g.GroupName,
        ep.Place,
        u.FullName AS TeacherName,
        c.FilePath AS CertificatePath
      FROM EventParticipants ep
      JOIN Events e ON ep.EventId = e.EventId
      JOIN Students s ON ep.StudentId = s.StudentId
      LEFT JOIN Groups g ON s.GroupId = g.GroupId
      LEFT JOIN Users u ON ep.TeacherId = u.UserId
      LEFT JOIN Certificates c ON c.EventId = ep.EventId AND c.StudentId = s.StudentId
      WHERE ep.EventId IN (${paramsPlaceholders})
      ORDER BY e.Date DESC, s.FullName
    `);

    // Остальная часть кода с созданием Excel остается без изменений
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Участники');

    worksheet.columns = [
      { header: 'Мероприятие', key: 'event', width: 30 },
      { header: 'Дата', key: 'date', width: 15 },
      { header: 'Студент', key: 'student', width: 25 },
      { header: 'Группа', key: 'group', width: 15 },
      { header: 'Место', key: 'place', width: 10 },
      { header: 'Преподаватель', key: 'teacher', width: 25 },
      { header: 'Сертификат', key: 'certificate', width: 15 }
    ];

    result.recordset.forEach(item => {
      worksheet.addRow({
        event: item.EventTitle,
        date: new Date(item.EventDate).toLocaleDateString(),
        student: item.StudentName,
        group: item.GroupName,
        place: item.Place || '-',
        teacher: item.TeacherName || '-',
        certificate: item.CertificatePath ? 'Да' : 'Нет'
      });
    });

    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=participants_report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Ошибка при экспорте:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/participants/multi-stats', async (req, res) => {
  try {
    const eventIdsStr = req.query.eventIds;
    if (!eventIdsStr) return res.status(400).json({ error: "Не указаны ID мероприятий" });

    const eventIds = eventIdsStr.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (eventIds.length === 0) return res.status(400).json({ error: "Не указаны ID мероприятий" });

    const request = new sql.Request();
    eventIds.forEach((id, i) => request.input(`eventId${i}`, sql.Int, id));

    const paramsPlaceholders = eventIds.map((_, i) => `@eventId${i}`).join(',');

    const result = await request.query(`
      SELECT 
        e.Title AS EventTitle,
        s.StudentId,
        s.FullName AS StudentName,
        g.GroupName,
        ep.Place,
        u.FullName AS TeacherName,
        c.FilePath AS CertificatePath
      FROM EventParticipants ep
      JOIN Events e ON ep.EventId = e.EventId
      JOIN Students s ON ep.StudentId = s.StudentId
      LEFT JOIN Groups g ON s.GroupId = g.GroupId
      LEFT JOIN Users u ON ep.TeacherId = u.UserId
      LEFT JOIN Certificates c ON c.EventId = ep.EventId AND c.StudentId = s.StudentId
      WHERE ep.EventId IN (${paramsPlaceholders})
    `);

    // Расчёт статистики
    const totalParticipations = result.recordset.length;
    const uniqueStudents = new Set(result.recordset.map(r => r.StudentId)).size;
    const certificatesIssued = result.recordset.filter(r => r.CertificatePath).length;
    const uniqueOrganizers = new Set(result.recordset.map(r => r.TeacherName).filter(Boolean)).size;
    const totalEvents = eventIds.length;
    const avgParticipantsPerEvent = totalEvents > 0 ? parseFloat((totalParticipations / totalEvents).toFixed(1)) : 0;

    // Топ-5 групп
    const groupMap = new Map();
    result.recordset.forEach(row => {
      if (row.GroupName) {
        groupMap.set(row.GroupName, (groupMap.get(row.GroupName) || 0) + 1);
      }
    });
    const topGroups = Array.from(groupMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([groupName, count]) => ({ groupName, count }));

    res.json({
      totalEvents,
      totalParticipations,
      uniqueStudents,
      certificatesIssued,
      avgParticipantsPerEvent,
      uniqueOrganizers,
      topGroups
    });
  } catch (err) {
    console.error('Ошибка статистики:', err);
    res.status(500).json({ error: err.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
