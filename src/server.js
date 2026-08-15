/**
 * Ponto de entrada da aplicação.
 * Configura o Express, servidor HTTP e Socket.IO.
 * Aplica middlewares de segurança (helmet, rate limiting).
 * Serve os arquivos estáticos da pasta public/.
 * Registra os handlers de socket e inicia a limpeza periódica de salas.
 * Por fim, inicia o servidor na porta configurada.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const setupSockets = require('./sockets');
const roomManager = require('./managers/RoomManager');

const app = express();
const server = http.createServer(app);

// Middleware de segurança para HTTP
app.use(helmet());

// Limite de requisições HTTP (para evitar abuso de rotas estáticas)
const httpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // limite de 100 requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(httpLimiter);

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