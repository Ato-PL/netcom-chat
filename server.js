const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

const users = {
    'ato': { password: 'ato', lastActive: null },
    'ota': { password: 'ota', lastActive: null }
};

let messages = [];

io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('login', ({ username, password }) => {
        if (users[username] && users[username].password === password) {
            currentUser = username;
            users[username].lastActive = Date.now();
            socket.emit('loginSuccess', { username, users, messages });
            io.emit('updateUsers', users);
        } else {
            socket.emit('loginFailed');
        }
    });

    socket.on('sendMessage', (msg) => {
        if (!currentUser) return;
        users[currentUser].lastActive = Date.now();

        if (currentUser === 'ato') {
            const [command, arg] = msg.split(' ');
            if (command === 'dodaj' && arg) {
                if (!users[arg]) {
                    users[arg] = { password: arg, lastActive: null };
                    io.emit('updateUsers', users);
                    io.emit('serverMessage', `🔹 Admin dodał użytkownika: ${arg}`);
                }
                return;
            }
            if (command === 'usuń' && arg) {
                if (arg !== 'ato' && users[arg]) {
                    delete users[arg];
                    io.emit('updateUsers', users);
                    io.emit('serverMessage', `🔹 Admin usunął użytkownika: ${arg}`);
                }
                return;
            }
            if (command === 'clear') {
                messages = [];
                io.emit('clearMessages');
                io.emit('serverMessage', `🗑️ Wiadomości zostały wyczyszczone przez admina.`);
                return;
            }
        }

        if (msg.startsWith('hasło ')) {
            const newPass = msg.substring(6).trim();
            if (newPass.length > 0) {
                users[currentUser].password = newPass;
                socket.emit('serverMessage', `✅ Hasło zmienione pomyślnie.`);
            }
            return;
        }

        const message = { user: currentUser, text: msg, time: new Date().toLocaleTimeString() };
        messages.push(message);
        io.emit('message', message);
    });

    socket.on('disconnect', () => {
        if (currentUser) {
            users[currentUser].lastActive = Date.now();
            io.emit('updateUsers', users);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
