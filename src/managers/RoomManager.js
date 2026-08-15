/**
 * Gerenciador de salas ativas.
 * Mantém um Map de salas (código -> objeto room) e fornece métodos para criar, obter e excluir salas.
 * Também localiza a sala de um socket e gerencia a limpeza periódica por inatividade.
 * É exportado como um singleton para ser usado pelos handlers de Socket.IO.
 */

const Game = require('../game/Game');
const { generateRoomCode } = require('../utils/helpers');
const config = require('../config');

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(mode) {
    const maxPlayers = mode === 'duplas' ? 4 : 2;
    let code;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const game = new Game(maxPlayers);
    const room = {
      code,
      maxPlayers,
      hostId: '',
      game,
      spectators: new Set(),
      lastActivity: Date.now()
    };

    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code);
  }

  deleteRoom(code) {
    this.rooms.delete(code);
  }

  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.game.players.some(p => p.id === socketId)) return room;
      if (room.spectators.has(socketId)) return room;
    }
    return null;
  }

  findPlayerIndex(room, socketId) {
    return room.game.players.findIndex(p => p.id === socketId);
  }

  touchRoom(room) {
    room.lastActivity = Date.now();
  }

  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [code, room] of this.rooms.entries()) {
        if (now - room.lastActivity > config.ROOM_IDLE_MS) {
          this.rooms.delete(code);
          console.log('Sala removida por inatividade:', code);
        }
      }
    }, config.CLEANUP_INTERVAL_MS);
  }
}

module.exports = new RoomManager();