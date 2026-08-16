/**
 * Funções auxiliares para envio de estado e mensagens via Socket.IO.
 *  - sendStateToRoom: envia o estado atual para todos os jogadores e espectadores.
 *  - emitRoomMessage: envia uma mensagem de toast para todos na sala.
 *  - sendStateAndCheckBots: envia o estado e agenda ações dos bots.
 */

function sendStateToRoom(io, roomManager, room) {
  const game = room.game;
  if (!game) return;
  roomManager.touchRoom(room);

  game.players.forEach(p => {
    // Não envia estado para bots (eles não têm socket)
    if (p.id && p.connected && !p.isBot) {
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
    ...game.players.filter(p => p.id && !p.isBot).map(p => p.id),
    ...room.spectators
  ]);

  ids.forEach(id => {
    const sock = io.sockets.sockets.get(id);
    if (sock) sock.emit('toast', msg);
  });
}

function sendStateAndCheckBots(io, roomManager, room, botManager) {
  sendStateToRoom(io, roomManager, room);
  if (botManager) {
    botManager.scheduleBotActions(io, roomManager, room);
  }
}

module.exports = {
  sendStateToRoom,
  emitRoomMessage,
  sendStateAndCheckBots
};