/**
 * Controle simples de taxa de eventos por socket.
 * Evita flood de mensagens e ações.
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 5000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.hits = new Map(); // socketId -> array de timestamps
  }

  isAllowed(socketId) {
    const now = Date.now();
    const timestamps = this.hits.get(socketId) || [];
    const recent = timestamps.filter(t => now - t < this.windowMs);
    if (recent.length >= this.maxRequests) {
      this.hits.set(socketId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(socketId, recent);
    return true;
  }

  // Limpeza periódica (opcional, evita crescimento do Map)
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, timestamps] of this.hits.entries()) {
        const recent = timestamps.filter(t => now - t < this.windowMs);
        if (recent.length === 0) this.hits.delete(id);
        else this.hits.set(id, recent);
      }
    }, this.windowMs * 2);
  }
}

module.exports = RateLimiter;