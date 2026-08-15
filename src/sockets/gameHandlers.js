/**
 * Handlers relacionados às ações do jogo:
 *  - playCard: jogar uma carta.
 *  - truco: pedir truco.
 *  - respondTruco: responder a um pedido de truco.
 *  - nextHand: avançar para a próxima mão.
 *  - restart: reiniciar a partida completa.
 *  - startGame: iniciar a partida (apenas host).
 *  - turnTimeout: tratar estouro de tempo do turno.
 * Utiliza a classe Game e as funções de envio de estado/mensagem.
 */

const { TRUCO_LEVEL_NAMES } = require('../game/constants');
const { sendStateToRoom, emitRoomMessage } = require('./utils');

module.exports = function gameHandlers(io, socket, roomManager) {
  socket.on('playCard', (card) => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (game.playCard(playerIndex, card)) {
      sendStateToRoom(io, roomManager, room);

      if (game.turnTimeLimit && game.started && !game.gameOver) {
        const turnPlayer = game.players[game.turnPlayerIndex];
        if (turnPlayer && turnPlayer.id) {
          io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
        }
      }
    } else {
      socket.emit('toast', 'Jogada inválida.');
    }
  });

  socket.on('truco', () => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (!game.requestTruco(playerIndex)) {
      socket.emit('toast', 'Não pode pedir truco agora ou não é sua vez.');
      return;
    }

    const level = game.challenge.level;
    const levelName = TRUCO_LEVEL_NAMES[level] || level;
    const playerName = game.players[playerIndex].name;
    game.addLog(playerName, 'Pediu truco', levelName);

    emitRoomMessage(io, roomManager, room, `🗣️ ${playerName} pediu ${levelName}!`);
    io.to(room.code).emit('trucoEffect', { level, player: playerName });
    sendStateToRoom(io, roomManager, room);
  });

  socket.on('respondTruco', (response) => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (game.respondTruco(playerIndex, response)) {
      const labels = { accept: 'aceitou', flee: 'fugiu', raise: 'aumentou' };
      const name = game.players[playerIndex]?.name || '?';
      if (labels[response]) {
        emitRoomMessage(io, roomManager, room, `${name} ${labels[response]} o truco.`);
      }
      if (response === 'accept' || response === 'raise') {
        io.to(room.code).emit('trucoEffect', { level: game.currentHandValue, player: name });
      }
      sendStateToRoom(io, roomManager, room);
    } else {
      socket.emit('toast', 'Resposta inválida.');
    }
  });

  socket.on('nextHand', () => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const game = room.game;
    if (!game || game.gameOver || game.handWinnerTeam === null) return;

    game.resetForNextHand();
    emitRoomMessage(io, roomManager, room, 'Nova mão!');
    sendStateToRoom(io, roomManager, room);

    if (game.turnTimeLimit && game.started && !game.gameOver) {
      const turnPlayer = game.players[game.turnPlayerIndex];
      if (turnPlayer && turnPlayer.id) {
        io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
      }
    }
  });

  socket.on('restart', () => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const game = room.game;
    if (!game || !game.gameOver) return;

    game.restartGame();
    game.addLog('Sistema', 'Nova partida iniciada', '');
    emitRoomMessage(io, roomManager, room, '🔄 Nova partida iniciada!');
    sendStateToRoom(io, roomManager, room);

    if (game.turnTimeLimit && game.started) {
      const turnPlayer = game.players[game.turnPlayerIndex];
      if (turnPlayer && turnPlayer.id) {
        io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
      }
    }
  });

  socket.on('startGame', ({ timeLimit }) => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const game = room.game;
    if (!game) return;

    if (room.hostId !== socket.id) {
      socket.emit('toast', 'Apenas o criador da sala pode iniciar a partida.');
      return;
    }

    const allConnected = game.players.every(
      p => p.connected && p.name && !p.name.startsWith('Jogador ')
    );
    if (!allConnected) {
      socket.emit('toast', 'Aguardando todos os jogadores se conectarem.');
      return;
    }

    if (game.started) {
      socket.emit('toast', 'A partida já foi iniciada.');
      return;
    }

    game.turnTimeLimit = timeLimit || null;
    game.started = true;
    game.addLog('Sistema', 'Partida iniciada', timeLimit ? `${timeLimit}s por turno` : 'sem limite de tempo');
    emitRoomMessage(
      io,
      roomManager,
      room,
      `🎮 Partida iniciada! ${timeLimit ? `Tempo por turno: ${timeLimit}s` : 'Sem limite de tempo'}`
    );

    io.to(room.code).emit('gameStarted', { timeLimit: game.turnTimeLimit });
    sendStateToRoom(io, roomManager, room);

    if (game.turnTimeLimit) {
      const turnPlayer = game.players[game.turnPlayerIndex];
      if (turnPlayer && turnPlayer.id) {
        io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
      }
    }
  });

  socket.on('turnTimeout', () => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (game.timeout(playerIndex)) {
      emitRoomMessage(io, roomManager, room, `⏰ ${game.players[playerIndex]?.name} perdeu a mão por tempo!`);
      sendStateToRoom(io, roomManager, room);
    }
  });
};