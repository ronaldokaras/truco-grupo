/**
 * Handlers relacionados ao gerenciamento de salas:
 *  - createRoom: cria uma nova sala e adiciona o jogador 0.
 *  - joinRoom: entra em uma sala existente como jogador ou espectador.
 *  - reconnectRoom: reconecta um jogador que perdeu a conexão usando token.
 *  - leaveRoom / disconnect: trata saída voluntária e desconexão.
 * Também contém a função handleDisconnect que verifica se a partida deve ser abortada.
 */

const { sanitizeName, generateToken } = require('../utils/helpers');
const { sendStateToRoom, emitRoomMessage } = require('./utils');

module.exports = function roomHandlers(io, socket, roomManager) {
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
          const connectedCount = game.players.filter(p => p.connected).length;
          if (connectedCount < 2) {
            game.abortGame();
            sendStateToRoom(io, roomManager, room);
          } else {
            sendStateToRoom(io, roomManager, room);
          }
        } else {
          sendStateToRoom(io, roomManager, room);
        }

        const anyone = game.players.some(p => p.connected);
        if (!anyone && room.spectators.size === 0) {
          roomManager.deleteRoom(room.code);
          console.log('Sala encerrada:', room.code);
        }
        return;
      }
    }
  };

  socket.on('createRoom', ({ mode, name }) => {
    const cleanName = sanitizeName(name, null);
    if (!cleanName) {
      socket.emit('toast', 'Digite um nome válido.');
      return;
    }

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
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('toast', 'Sala não encontrada. Verifique o código.');
      return;
    }

    const cleanName = sanitizeName(name, null);
    if (!cleanName) {
      socket.emit('toast', 'Digite um nome válido.');
      return;
    }

    const freeSlot = room.game.players.findIndex(p => !p.connected);
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
    const room = roomManager.getRoom(roomCode);
    if (!room || !token) {
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
};