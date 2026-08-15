/**
 * Handler para mensagens de chat.
 * Identifica o remetente (jogador ou espectador) e emite a mensagem para todos na sala.
 * Aplica sanitização e limite de taxa.
 */

const { sanitizeMessage } = require('../utils/validators');

module.exports = function chatHandlers(io, socket, roomManager, chatLimiter) {
  socket.on('chatMessage', (data) => {
    if (!chatLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Você está enviando mensagens muito rápido.');
      return;
    }

    const message = sanitizeMessage(data.message);
    if (!message) return;

    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;

    let name = socket.name || 'Anônimo';
    let isSpectator = socket.isSpectator || false;

    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex !== -1) {
      name = room.game.players[playerIndex].name;
    } else {
      if (!name || name === 'Anônimo') name = 'Espectador';
    }

    io.to(room.code).emit('chatMessage', {
      name,
      message,
      isSpectator
    });
  });
};