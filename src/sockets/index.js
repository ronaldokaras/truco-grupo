/**
 * Configuração central dos eventos Socket.IO.
 * Registra os handlers de sala, jogo e chat para cada nova conexão.
 * Recebe o io e o roomManager para permitir que os handlers acessem salas e emitam eventos.
 */

const roomHandlers = require('./roomHandlers');
const gameHandlers = require('./gameHandlers');
const chatHandlers = require('./chatHandlers');

module.exports = function setupSockets(io, roomManager) {
  io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);

    roomHandlers(io, socket, roomManager);
    gameHandlers(io, socket, roomManager);
    chatHandlers(io, socket, roomManager);
  });
};