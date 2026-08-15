/**
 * Funções de validação para entradas do servidor.
 * Garantem que os dados recebidos dos sockets sejam seguros e válidos.
 */

const { SUITS, RANKS } = require('../game/constants');

function isValidName(name) {
  if (typeof name !== 'string') return false;
  const cleaned = name.replace(/[<>]/g, '').trim();
  return cleaned.length > 0 && cleaned.length <= 18;
}

function isValidRoomCode(code) {
  if (typeof code !== 'string') return false;
  return /^[A-Z2-9]{4}$/.test(code.trim().toUpperCase());
}

function isValidCard(card) {
  if (!card || typeof card !== 'object') return false;
  return SUITS.includes(card.suit) && RANKS.includes(card.rank);
}

function isValidTrucoResponse(response) {
  return ['accept', 'flee', 'raise'].includes(response);
}

function sanitizeMessage(msg) {
  if (typeof msg !== 'string') return '';
  return msg.replace(/[<>]/g, '').trim().slice(0, 80);
}

module.exports = {
  isValidName,
  isValidRoomCode,
  isValidCard,
  isValidTrucoResponse,
  sanitizeMessage
};