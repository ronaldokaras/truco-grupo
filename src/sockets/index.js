/**
 * Configuração central dos eventos Socket.IO.
 * Registra os handlers de sala, jogo e chat para cada nova conexão.
 * Aplica limitadores de taxa globais para eventos críticos.
 */

const roomHandlers = require('./roomHandlers');
const gameHandlers = require('./gameHandlers');
const chatHandlers = require('./chatHandlers');
const RateLimiter = require('../utils/rateLimiter');
const BotManager = require('../game/BotManager');  // 🔹 bots

const gameActionLimiter = new RateLimiter(10, 5000);   // ações de jogo
const chatLimiter = new RateLimiter(5, 5000);          // mensagens de chat
const botManager = new BotManager();                   // 🔹 bots

module.exports = function setupSockets(io, roomManager) {
  // Inicia limpeza dos limitadores (opcional)
  gameActionLimiter.startCleanup();
  chatLimiter.startCleanup();

  io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);

    roomHandlers(io, socket, roomManager);
    gameHandlers(io, socket, roomManager, gameActionLimiter, botManager); 
    chatHandlers(io, socket, roomManager, chatLimiter);
  });
};