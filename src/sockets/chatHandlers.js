/**
 * Handler para mensagens de chat.
 * Identifica o remetente (jogador ou espectador) e emite a mensagem para todos na sala.
 */

module.exports = function chatHandlers(io, socket, roomManager) {
  socket.on('chatMessage', (data) => {
    const { message } = data;
    if (!message || message.trim() === '') return;

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
      message: message.trim(),
      isSpectator
    });
  });
};