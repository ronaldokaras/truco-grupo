/**
 * Ponto de entrada da aplicação.
 * Configura o Express, servidor HTTP e Socket.IO.
 * Serve os arquivos estáticos da pasta public/.
 * Registra os handlers de socket e inicia a limpeza periódica de salas.
 * Por fim, inicia o servidor na porta configurada.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const config = require('./config');
const setupSockets = require('./sockets');
const roomManager = require('./managers/RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.CORS_ORIGIN },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, '../public')));

setupSockets(io, roomManager);
roomManager.startCleanup();

server.listen(config.PORT, () => {
  console.log(`Trucou rodando na porta ${config.PORT}`);
});