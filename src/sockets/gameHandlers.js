/**
 * Handlers relacionados às ações do jogo:
 *  - playCard, truco, respondTruco, nextHand, restart, startGame, turnTimeout, elevenDecision, showHandToPartner.
 * Utiliza a classe Game e as funções de envio de estado/mensagem, com suporte a bots.
 */

const { TRUCO_LEVEL_NAMES } = require('../game/constants');
const { sendStateAndCheckBots, emitRoomMessage } = require('./utils');
const { isValidCard, isValidTrucoResponse } = require('../utils/validators');

module.exports = function gameHandlers(io, socket, roomManager, actionLimiter, botManager) {
  socket.on('playCard', (card) => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Muitas ações rapidamente. Aguarde um instante.');
      return;
    }

    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;

    // Validação de carta
    if (game.ironHand) {
      if (typeof card.index !== 'number') {
        socket.emit('toast', 'Jogada inválida.');
        return;
      }
    } else {
      if (!isValidCard(card)) {
        socket.emit('toast', 'Carta inválida.');
        return;
      }
    }

    if (game.playCard(playerIndex, card)) {
      sendStateAndCheckBots(io, roomManager, room, botManager);

      if (game.turnTimeLimit && game.started && !game.gameOver) {
        const turnPlayer = game.players[game.turnPlayerIndex];
        if (turnPlayer && turnPlayer.id && !turnPlayer.isBot) {
          io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
        }
      }
    } else {
      socket.emit('toast', 'Jogada inválida.');
    }
  });

  socket.on('truco', () => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Muitas ações rapidamente.');
      return;
    }

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
    sendStateAndCheckBots(io, roomManager, room, botManager);
  });

  socket.on('respondTruco', (response) => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Muitas ações rapidamente.');
      return;
    }
    if (!isValidTrucoResponse(response)) {
      socket.emit('toast', 'Resposta inválida.');
      return;
    }

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
      sendStateAndCheckBots(io, roomManager, room, botManager);
    } else {
      socket.emit('toast', 'Resposta inválida.');
    }
  });

  socket.on('nextHand', () => {
    if (!actionLimiter.isAllowed(socket.id)) return;
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const game = room.game;
    if (!game || game.gameOver || game.handWinnerTeam === null) return;

    game.resetForNextHand();
    emitRoomMessage(io, roomManager, room, 'Nova mão!');
    sendStateAndCheckBots(io, roomManager, room, botManager);

    if (game.turnTimeLimit && game.started && !game.gameOver) {
      const turnPlayer = game.players[game.turnPlayerIndex];
      if (turnPlayer && turnPlayer.id && !turnPlayer.isBot) {
        io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
      }
    }
  });

  socket.on('restart', () => {
    if (!actionLimiter.isAllowed(socket.id)) return;
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const game = room.game;
    if (!game || !game.gameOver) return;

    game.restartGame();
    game.addLog('Sistema', 'Nova partida iniciada', '');
    emitRoomMessage(io, roomManager, room, '🔄 Nova partida iniciada!');
    sendStateAndCheckBots(io, roomManager, room, botManager);

    if (game.turnTimeLimit && game.started) {
      const turnPlayer = game.players[game.turnPlayerIndex];
      if (turnPlayer && turnPlayer.id && !turnPlayer.isBot) {
        io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
      }
    }
  });

  socket.on('startGame', ({ timeLimit }) => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Muitas ações rapidamente.');
      return;
    }

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

    if (timeLimit !== null && ![30, 60, 180, 0].includes(Number(timeLimit))) {
      socket.emit('toast', 'Valor de tempo limite inválido.');
      return;
    }

    game.turnTimeLimit = timeLimit || null;
    game.started = true;
    game.addLog('Sistema', 'Partida iniciada', timeLimit ? `${timeLimit}s por turno` : 'sem limite de tempo');
    emitRoomMessage(io, roomManager, room, `🎮 Partida iniciada! ${timeLimit ? `Tempo por turno: ${timeLimit}s` : 'Sem limite de tempo'}`);

    io.to(room.code).emit('gameStarted', { timeLimit: game.turnTimeLimit });
    sendStateAndCheckBots(io, roomManager, room, botManager);

    if (game.turnTimeLimit) {
      const turnPlayer = game.players[game.turnPlayerIndex];
      if (turnPlayer && turnPlayer.id && !turnPlayer.isBot) {
        io.to(turnPlayer.id).emit('turnTimer', { timeLimit: game.turnTimeLimit });
      }
    }
  });

  socket.on('turnTimeout', () => {
    if (!actionLimiter.isAllowed(socket.id)) return;
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (game.timeout(playerIndex)) {
      emitRoomMessage(io, roomManager, room, `⏰ ${game.players[playerIndex]?.name} perdeu a mão por tempo!`);
      sendStateAndCheckBots(io, roomManager, room, botManager);
    }
  });

  socket.on('elevenDecision', (decision) => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Muitas ações. Aguarde.');
      return;
    }

    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (!game.waitingElevenDecision) {
      socket.emit('toast', 'Não é hora de decidir a Mão de Onze.');
      return;
    }

    if (decision !== 'play' && decision !== 'flee') {
      socket.emit('toast', 'Decisão inválida.');
      return;
    }

    const result = game.handleElevenDecision(playerIndex, decision);
    if (result) {
      if (decision === 'flee') {
        emitRoomMessage(io, roomManager, room, `Time ${game.elevenDecisionTeam + 1} fugiu da Mão de Onze.`);
      } else {
        emitRoomMessage(io, roomManager, room, 'Mão de Onze aceita! Vale 3 pontos.');
      }
      sendStateAndCheckBots(io, roomManager, room, botManager);
    } else {
      socket.emit('toast', 'Você não pode decidir agora.');
    }
  });

  socket.on('showHandToPartner', () => {
    if (!actionLimiter.isAllowed(socket.id)) {
      socket.emit('toast', 'Muitas ações. Aguarde.');
      return;
    }

    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    const playerIndex = roomManager.findPlayerIndex(room, socket.id);
    if (playerIndex === -1) return;

    const game = room.game;
    if (game.showHandToPartner(playerIndex)) {
      emitRoomMessage(io, roomManager, room, '👀 Cartas reveladas para o parceiro por 5 segundos!');
      sendStateAndCheckBots(io, roomManager, room, botManager);
      // Agenda ocultar após 5 segundos
      setTimeout(() => {
        if (room.game === game) {
          sendStateAndCheckBots(io, roomManager, room, botManager);
        }
      }, 5000);
    } else {
      socket.emit('toast', 'Não é possível revelar as cartas agora.');
    }
  });
};