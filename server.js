const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

let players = {};
let puzzlesCompleted = 0;
const totalPuzzles = 3;
let epsteinPos = { x: 0, z: 0 };

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'join') {
            players[id] = {
                id,
                name: data.name,
                color: data.color,
                x: 0, y: 1, z: 20,
                alive: true
            };
            ws.send(JSON.stringify({ type: 'init', id, players }));
            broadcast({ type: 'playerJoined', player: players[id] });
        }

        if (data.type === 'move' && players[id]) {
            players[id].x = data.x;
            players[id].y = data.y;
            players[id].z = data.z;
            players[id].rotation = data.rotation;
            broadcast({ type: 'playerMoved', id, ...players[id] });
        }

        if (data.type === 'died' && players[id]) {
            players[id].alive = false;
            broadcast({ type: 'playerDied', id });
        }

        if (data.type === 'puzzleDone') {
            puzzlesCompleted++;
            broadcast({ type: 'puzzleUpdate', count: puzzlesCompleted });
            if (puzzlesCompleted >= totalPuzzles) {
                broadcast({ type: 'swatArrived' });
            }
        }
    });

    ws.on('close', () => {
        delete players[id];
        broadcast({ type: 'playerLeft', id });
    });
});

function broadcast(msg) {
    wss.clients.forEach(client => {
        if (client.readyState === 1) client.send(JSON.stringify(msg));
    });
}

// Loop simples do Bot Epstein
setInterval(() => {
    // Segue o primeiro jogador vivo encontrado
    const target = Object.values(players).find(p => p.alive);
    if (target) {
        const dx = target.x - epsteinPos.x;
        const dz = target.z - epsteinPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.5) {
            epsteinPos.x += (dx / dist) * 0.15;
            epsteinPos.z += (dz / dist) * 0.15;
            broadcast({ type: 'epsteinMoved', x: epsteinPos.x, z: epsteinPos.z });
        }
    }
}, 50);

server.listen(3000, '0.0.0.0', () => {
    console.log('Servidor rodando! Para jogar na mesma rede, acesse o IP da sua máquina na porta 3000');
});