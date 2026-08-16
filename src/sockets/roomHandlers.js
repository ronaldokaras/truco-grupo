/**
 * Handlers relacionados ao gerenciamento de salas:
 *  - createRoom, joinRoom, reconnectRoom, leaveRoom, disconnect, addBot.
 */

const { sanitizeName, generateToken } = require('../utils/helpers');
const { isValidName, isValidRoomCode } = require('../utils/validators');
const { sendStateToRoom, emitRoomMessage, sendStateAndCheckBots } = require('./utils');

module.exports = function roomHandlers(io, socket, roomManager, botManager) {
  const handleDisconnect = (socket, voluntary) => {
    console.log('Desconectado:', socket.id);

    for (const room of roomManager.rooms.values()) {
      if (room.spectators.has(socket.id)) {
        room.spectators.delete(socket.id);
        return;
      }

      const player = room.game?.players.find(p => p.id === socket.id);
      if (player) {
        player.connected = false;

        if (voluntary) {
          player.id = '';
          player.token = '';
          player.name = `Jogador ${room.game.players.indexOf(player) + 1}`;
          emitRoomMessage(io, roomManager, room, `${player.name} saiu da sala.`);
        } else {
          emitRoomMessage(io, roomManager, room, `${player.name} desconectou. Pode reconectar.`);
        }

        const game = room.game;
        if (game && game.started) {
          const connectedCount = game.players.filter(p => p.connected && !p.isBot).length;
          const totalPlayersNeeded = game.maxPlayers;
          if (connectedCount < 2) {
            game.abortGame();
            sendStateToRoom(io, roomManager, room);
          } else {
            sendStateToRoom(io, roomManager, room);
          }
        } else {
          sendStateToRoom(io, roomManager, room);
        }

        const anyone = game.players.some(p => p.connected && !p.isBot);
        if (!anyone && room.spectators.size === 0) {
          roomManager.deleteRoom(room.code);
          console.log('Sala encerrada:', room.code);
        }
        return;
      }
    }
  };

  socket.on('createRoom', ({ mode, name }) => {
    if (!isValidName(name)) {
      socket.emit('toast', 'Digite um nome válido (1 a 18 caracteres).');
      return;
    }
    if (mode !== '1v1' && mode !== 'duplas') {
      socket.emit('toast', 'Modo inválido.');
      return;
    }

    const cleanName = sanitizeName(name, null);
    const room = roomManager.createRoom(mode);
    const token = generateToken();

    room.hostId = socket.id;
    room.game.players[0].id = socket.id;
    room.game.players[0].token = token;
    room.game.players[0].name = cleanName;
    room.game.players[0].connected = true;

    socket.join(room.code);
    socket.emit('roomJoined', {
      roomCode: room.code,
      token,
      index: 0,
      isHost: true,
      maxPlayers: room.maxPlayers
    });
    socket.emit('gameState', room.game.getStateForPlayer(socket.id, room.code));
    socket.emit('toast', `Sala ${room.code} criada! Compartilhe o código.`);
  });

  socket.on('joinRoom', ({ code, name }) => {
    const roomCode = (code || '').toUpperCase().trim();
    if (!isValidRoomCode(roomCode)) {
      socket.emit('toast', 'Código de sala inválido.');
      return;
    }
    if (!isValidName(name)) {
      socket.emit('toast', 'Digite um nome válido (1 a 18 caracteres).');
      return;
    }

    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('toast', 'Sala não encontrada. Verifique o código.');
      return;
    }

    const cleanName = sanitizeName(name, null);
    const freeSlot = room.game.players.findIndex(p => !p.connected && !p.isBot);
    if (freeSlot === -1) {
      socket.name = cleanName;
      socket.isSpectator = true;
      room.spectators.add(socket.id);
      socket.join(roomCode);
      socket.emit('roomJoined', {
        roomCode,
        token: null,
        index: -1,
        isHost: false,
        maxPlayers: room.maxPlayers,
        spectator: true
      });
      socket.emit('spectator', room.game.getSpectatorState(roomCode));
      socket.emit('toast', 'Sala cheia. Você entrou como espectador.');
      return;
    }

    const token = generateToken();
    room.game.players[freeSlot].id = socket.id;
    room.game.players[freeSlot].token = token;
    room.game.players[freeSlot].name = cleanName;
    room.game.players[freeSlot].connected = true;
    socket.name = cleanName;
    socket.isSpectator = false;

    socket.join(roomCode);
    socket.emit('roomJoined', {
      roomCode,
      token,
      index: freeSlot,
      isHost: false,
      maxPlayers: room.maxPlayers
    });
    emitRoomMessage(io, roomManager, room, `${cleanName} entrou na sala!`);
    sendStateToRoom(io, roomManager, room);
  });

  socket.on('reconnectRoom', ({ code, token }) => {
    const roomCode = (code || '').toUpperCase().trim();
    if (!isValidRoomCode(roomCode) || !token) {
      socket.emit('reconnectFailed');
      return;
    }

    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('reconnectFailed');
      return;
    }

    const playerIndex = room.game.players.findIndex(p => p.token === token);
    if (playerIndex === -1) {
      socket.emit('reconnectFailed');
      return;
    }

    const player = room.game.players[playerIndex];
    if (player.id && player.id !== socket.id) {
      const oldSock = io.sockets.sockets.get(player.id);
      if (oldSock) {
        oldSock.emit('toast', 'Você reconectou em outro dispositivo.');
        oldSock.disconnect(true);
      }
    }

    player.id = socket.id;
    player.connected = true;
    socket.name = player.name;
    socket.isSpectator = false;
    room.spectators.delete(socket.id);
    socket.join(roomCode);

    socket.emit('roomJoined', {
      roomCode,
      token,
      index: playerIndex,
      isHost: room.hostId === player.id || room.game.players[0].token === token,
      maxPlayers: room.maxPlayers,
      reconnected: true
    });
    socket.emit('gameState', room.game.getStateForPlayer(socket.id, roomCode));
    emitRoomMessage(io, roomManager, room, `${player.name} reconectou.`);
    sendStateToRoom(io, roomManager, room);
  });

  socket.on('leaveRoom', () => {
    handleDisconnect(socket, true);
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket, false);
  });

  // Adicionar bot
  socket.on('addBot', () => {
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('toast', 'Apenas o criador pode adicionar bots.');
      return;
    }

    const freeSlot = room.game.players.findIndex(p => !p.connected && !p.isBot);
    if (freeSlot === -1) {
      socket.emit('toast', 'Não há vagas disponíveis.');
      return;
    }

    const bot = roomManager.createBot(room);
    if (bot) {
      emitRoomMessage(io, roomManager, room, `🤖 ${bot.name} entrou na sala!`);
      sendStateAndCheckBots(io, roomManager, room, botManager);
    } else {
      socket.emit('toast', 'Não foi possível adicionar bot.');
    }
  });
};