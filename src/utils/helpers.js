/**
 * Funções utilitárias gerais (sem dependência de Socket.IO).
 *  - sanitizeName: limpa e valida nomes de jogadores.
 *  - generateToken: gera token único para reconexão.
 *  - generateRoomCode: gera código de sala de 4 caracteres.
 */

const crypto = require('crypto');
const config = require('../config');

function sanitizeName(raw, fallback) {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[<>]/g, '').trim().slice(0, 18);
  return cleaned || fallback;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < config.ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

module.exports = {
  sanitizeName,
  generateToken,
  generateRoomCode
};