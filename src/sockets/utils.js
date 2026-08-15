/**
 * Funções auxiliares para envio de estado e mensagens via Socket.IO.
 *  - sendStateToRoom: envia o estado atual para todos os jogadores e espectadores.
 *  - emitRoomMessage: envia uma mensagem de toast para todos na sala.
 * Centralizam a lógica de notificação e mantêm os handlers mais limpos.
 */

function sendStateToRoom(io, roomManager, room) {
  const game = room.game;
  if (!game) return;
  roomManager.touchRoom(room);

  game.players.forEach(p => {
    if (p.id && p.connected) {
      const sock = io.sockets.sockets.get(p.id);
      if (sock) sock.emit('gameState', game.getStateForPlayer(p.id, room.code));
    }
  });

  room.spectators.forEach(id => {
    const sock = io.sockets.sockets.get(id);
    if (sock) sock.emit('spectator', game.getSpectatorState(room.code));
  });
}

function emitRoomMessage(io, roomManager, room, msg) {
  const game = room.game;
  if (!game) return;

  const ids = new Set([
    ...game.players.filter(p => p.id).map(p => p.id),
    ...room.spectators
  ]);

  ids.forEach(id => {
    const sock = io.sockets.sockets.get(id);
    if (sock) sock.emit('toast', msg);
  });
}

module.exports = {
  sendStateToRoom,
  emitRoomMessage
};