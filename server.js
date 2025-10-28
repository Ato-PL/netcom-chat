const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.use(express.static(path.join(__dirname, 'public')));

// === ŚCIEŻKI DO PLIKÓW ===
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// === FUNKCJE POMOCNICZE ===
function loadData(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file));
    } catch {
        return fallback;
    }
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// === WCZYTYWANIE DANYCH ===
let users = loadData(USERS_FILE, {});
let messages = loadData(MESSAGES_FILE, []);

io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('login', ({ username, password }) => {
        if (users[username] && users[username].password === password) {
            currentUser = username;
            users[username].lastActive = Date.now();
            saveData(USERS_FILE, users);
            socket.emit('loginSuccess', { username, users, messages });
            io.emit('updateUsers', users);
        } else {
            socket.emit('loginFailed');
        }
    });

    socket.on('sendMessage', (msg) => {
        if (!currentUser) return;
        users[currentUser].lastActive = Date.now();

        // ===== KOMENDY ADMINA =====
        if (currentUser === 'ato') {
            const [command, arg] = msg.split(' ');
            if (command === 'dodaj' && arg) {
                if (!users[arg]) {
                    users[arg] = { password: arg, lastActive: null };
                    saveData(USERS_FILE, users);
                    io.emit('updateUsers', users);
                    io.emit('serverMessage', `🔹 Admin dodał użytkownika: ${arg}`);
                }
                return;
            }
            if (command === 'usuń' && arg) {
                if (arg !== 'ato' && users[arg]) {
                    delete users[arg];
                    saveData(USERS_FILE, users);
                    io.emit('updateUsers', users);
                    io.emit('serverMessage', `🔹 Admin usunął użytkownika: ${arg}`);
                }
                return;
            }
            if (command === 'clear') {
                messages = [];
                saveData(MESSAGES_FILE, messages);
                io.emit('clearMessages');
                io.emit('serverMessage', `🗑️ Wiadomości zostały wyczyszczone przez admina.`);
                return;
            }
        }

        // ===== KOMENDA: zmiana hasła =====
        if (msg.startsWith('hasło ')) {
            const newPass = msg.substring(6).trim();
            if (newPass.length > 0) {
                users[currentUser].password = newPass;
                saveData(USERS_FILE, users);
                socket.emit('serverMessage', `✅ Hasło zmienione pomyślnie.`);
            }
            return;
        }

        // ===== NORMALNA WIADOMOŚĆ =====
        const message = { user: currentUser, text: msg, time: new Date().toLocaleTimeString() };
        messages.push(message);
        saveData(MESSAGES_FILE, messages);
        io.emit('message', message);
    });

    socket.on('disconnect', () => {
        if (currentUser) {
            users[currentUser].lastActive = Date.now();
            saveData(USERS_FILE, users);
            io.emit('updateUsers', users);
        }
    });
});

server.listen(3000, () => console.log('✅ Server running on port 3000'));

