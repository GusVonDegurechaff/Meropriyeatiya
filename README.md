# Система учёта мероприятий колледжа

Веб-приложение для учёта мероприятий, участников, сертификатов и преподавателей колледжа.

## Технологии

- **Backend**: Node.js + Express
- **База данных**: Microsoft SQL Server
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Загрузка файлов**: Multer
- **Работа с Excel**: xlsx + ExcelJS

## Установка и запуск

### 1. Клонирование репозитория
```bash
git clone https://github.com/GusVonDegurechaff/Meropriyeatiya
cd meropriyeatiya
```

Если папки node_modules ещё нет — выполни следующую команду:
```
npm install
```

Создание папок для загрузки файлов
```
mkdir -p uploads/orders uploads/certification
```
Примечание: Папка uploads/ добавлена в .gitignore, поэтому она не будет загружаться в репозиторий.(создать вручную при ошибке)

Запуск сервера
```
node server.js
```

При возникновении вопросов обращаться к разработчику сея деяния
