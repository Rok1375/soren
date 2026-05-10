import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

const PORT = Number(process.env.PORT || 3001);
const DEFAULT_CLIENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100); // 100 requests per minute
const RATE_LIMIT_MAX_SOCKET_CONNECTIONS_PER_IP = Number(process.env.RATE_LIMIT_MAX_SOCKET_CONNECTIONS_PER_IP || 10); // 10 sockets per IP
const SOCKET_JOIN_RATE_LIMIT = Number(process.env.SOCKET_JOIN_RATE_LIMIT || 30); // 30 channel joins per minute

function isAllowedOrigin(origin) {
  // Allow server-to-server health checks, curl, and platform probes without a browser Origin header.
  if (!origin) return true;
  return CLIENT_ORIGINS.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CLIENT_ORIGIN.`));
  },
  credentials: true,
};

// Rate limiter middleware for HTTP endpoints
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind a proxy, otherwise use IP
    // express-rate-limit will handle IPv6 normalization via ipKeyGenerator
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const [ip] = forwarded.split(',');
      return ip.trim();
    }
    // Return req.ip which handles both IPv4 and IPv6 correctly
    return req.ip;
  },
  message: {
    ok: false,
    error: 'Too many requests, please try again later.',
  },
  handler: (req, res, _next, options) => {
    console.log(`[Rate Limit] HTTP rate limit exceeded for ${req.ip}`, {
      method: req.method,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
});

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// Apply rate limiting to all endpoints except health check
app.use('/health', (_req, res, next) => {
  // Health check is rate-limited separately with higher limits
  res.rateLimited = false;
  next();
});
app.use(limiter);

// Health check with more detailed status
app.get('/health', (_req, res) => {
  const channelCount = channels.size;
  const totalUsers = [...channels.values()].reduce((sum, ch) => sum + ch.users.size, 0);
  res.json({
    ok: true,
    app: 'Walkie Talking signaling server',
    status: 'healthy',
    uptime: process.uptime(),
    channels: channelCount,
    users: totalUsers,
    timestamp: Date.now(),
  });
});

const httpServer = http.createServer(app);

// Track socket connections per IP for rate limiting
const socketConnectionsPerIp = new Map();

function getIpAddress(socket) {
  // Get IP from handshake data or socket
  const handshake = socket?.handshake;
  const forwarded = handshake?.headers?.['x-forwarded-for'];
  if (forwarded) {
    const [ip] = forwarded.split(',');
    return ip.trim();
  }
  return handshake?.address || socket?.client?.conn?.remoteAddress || 'unknown';
}

function incrementSocketCount(ip) {
  const current = socketConnectionsPerIp.get(ip) || 0;
  socketConnectionsPerIp.set(ip, current + 1);
}

function decrementSocketCount(ip) {
  const current = socketConnectionsPerIp.get(ip) || 0;
  if (current <= 1) {
    socketConnectionsPerIp.delete(ip);
  } else {
    socketConnectionsPerIp.set(ip, current - 1);
  }
}

function getSocketCountForIp(ip) {
  return socketConnectionsPerIp.get(ip) || 0;
}

// Track channel join attempts per socket for rate limiting
const channelJoinAttempts = new Map();

function checkChannelJoinRateLimit(socketId) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxAttempts = SOCKET_JOIN_RATE_LIMIT;
  
  let attempts = channelJoinAttempts.get(socketId) || [];
  // Filter to only recent attempts within the window
  attempts = attempts.filter(timestamp => now - timestamp < windowMs);
  
  if (attempts.length >= maxAttempts) {
    channelJoinAttempts.set(socketId, attempts);
    return false; // Rate limited
  }
  
  attempts.push(now);
  channelJoinAttempts.set(socketId, attempts);
  return true; // Allowed
}

// Cleanup old join attempts periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 60000;
  for (const [socketId, attempts] of channelJoinAttempts.entries()) {
    const recent = attempts.filter(timestamp => now - timestamp < windowMs);
    if (recent.length === 0) {
      channelJoinAttempts.delete(socketId);
    } else {
      channelJoinAttempts.set(socketId, recent);
    }
  }
}, 30000); // Cleanup every 30 seconds
const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CLIENT_ORIGIN.`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

/**
 * Channel state lives in memory for the MVP.
 * In production, use Redis adapter + persistent presence if you run multiple Node instances.
 */
const channels = new Map();

function normalizeChannel(channel) {
  return String(channel ?? '').trim();
}

function validateChannel(channel) {
  const value = normalizeChannel(channel);
  if (!/^\d+$/.test(value)) {
    return { ok: false, value, error: 'Channel must contain numbers only.' };
  }
  if (value.length < 3) {
    return { ok: false, value, error: 'Channel must be at least 3 digits.' };
  }
  if (value.length > 6) {
    return { ok: false, value, error: 'Channel must be 6 digits or fewer.' };
  }
  return { ok: true, value };
}

function createChannelState() {
  return {
    users: new Map(),
    hostSocketId: null,
    locked: false,
    createdAt: Date.now(),
    transmittingSocketId: null,
  };
}

function getChannel(channelNumber) {
  return channels.get(channelNumber);
}

function getOrCreateChannel(channelNumber) {
  if (!channels.has(channelNumber)) {
    channels.set(channelNumber, createChannelState());
  }
  return channels.get(channelNumber);
}

function getNextHostSocketId(channel) {
  return [...channel.users.values()]
    .sort((a, b) => a.connectedAt - b.connectedAt)
    .at(0)?.socketId || null;
}

function channelPayload(channelNumber) {
  const channel = getChannel(channelNumber);
  if (!channel) return null;

  return {
    channelNumber,
    onlineCount: channel.users.size,
    users: [...channel.users.values()],
    hostSocketId: channel.hostSocketId,
    locked: channel.locked,
    createdAt: channel.createdAt,
    transmittingSocketId: channel.transmittingSocketId,
    transmittingUser: channel.transmittingSocketId
      ? channel.users.get(channel.transmittingSocketId) || null
      : null,
  };
}

function emitChannelState(channelNumber) {
  const payload = channelPayload(channelNumber);
  if (payload) io.to(channelNumber).emit('channel:state', payload);
}

function leaveCurrentChannel(socket) {
  const channelNumber = socket.data.channelNumber;
  if (!channelNumber) return;

  const channel = getChannel(channelNumber);
  if (!channel) return;
  const wasTransmitting = channel.transmittingSocketId === socket.id;
  const wasHost = channel.hostSocketId === socket.id;

  channel.users.delete(socket.id);
  socket.leave(channelNumber);

  if (wasTransmitting) {
    channel.transmittingSocketId = null;
    socket.to(channelNumber).emit('ptt:ended', { socketId: socket.id });
  }

  socket.to(channelNumber).emit('peer:left', { socketId: socket.id });

  if (channel.users.size === 0) {
    channels.delete(channelNumber);
  } else {
    if (wasHost) channel.hostSocketId = getNextHostSocketId(channel);
    emitChannelState(channelNumber);
  }

  socket.data.channelNumber = null;
  socket.data.username = null;
}

io.on('connection', (socket) => {
  const ip = getIpAddress(socket);
  incrementSocketCount(ip);
  
  // Check if IP has exceeded maximum socket connections
  const socketCount = getSocketCountForIp(ip);
  if (socketCount > RATE_LIMIT_MAX_SOCKET_CONNECTIONS_PER_IP) {
    console.log(`[Rate Limit] Socket connection limit exceeded for IP ${ip}`, {
      socketCount,
      limit: RATE_LIMIT_MAX_SOCKET_CONNECTIONS_PER_IP,
    });
    socket.emit('server:error', {
      error: 'Connection limit exceeded for your IP address.',
      code: 'CONNECTION_LIMIT_EXCEEDED',
    });
    socket.disconnect(true);
    decrementSocketCount(ip);
    return;
  }

  console.log(`[Socket] Connected: ${socket.id} from ${ip} (sockets: ${socketCount})`);
  
  socket.emit('server:ready', { socketId: socket.id });

  // Error handler for socket events
  socket.on('error', (err) => {
    console.error(`[Socket Error] Error event on socket ${socket.id}`, {
      error: err?.message,
      stack: err?.stack,
    });
  });

  socket.on('channel:join', ({ username, channelNumber }, ack) => {
    // Rate limit channel joins
    if (!checkChannelJoinRateLimit(socket.id)) {
      console.log(`[Rate Limit] Channel join rate limit exceeded for socket ${socket.id}`);
      ack?.({ 
        ok: false, 
        error: 'Too many join attempts. Please wait a moment before trying again.' 
      });
      return;
    }

    const safeUsername = String(username || 'Operator').trim().slice(0, 24) || 'Operator';
    const channelValidation = validateChannel(channelNumber);

    if (!channelValidation.ok) {
      ack?.({ ok: false, error: channelValidation.error });
      return;
    }

    const safeChannel = channelValidation.value;
    const existingChannel = getChannel(safeChannel);
    const alreadyInsideChannel = socket.data.channelNumber === safeChannel
      && existingChannel?.users.has(socket.id);

    if (existingChannel?.locked && !alreadyInsideChannel) {
      ack?.({ ok: false, error: 'CHANNEL_LOCKED' });
      return;
    }

    if (alreadyInsideChannel) {
      const existingUser = existingChannel.users.get(socket.id);
      existingChannel.users.set(socket.id, {
        ...existingUser,
        username: safeUsername,
      });
      socket.data.username = safeUsername;
      const existingPeers = [...existingChannel.users.keys()].filter((id) => id !== socket.id);
      const state = channelPayload(safeChannel);
      ack?.({
        ok: true,
        socketId: socket.id,
        channel: safeChannel,
        channelNumber: safeChannel,
        users: existingChannel.users.size,
        peers: existingPeers,
        isHost: existingChannel.hostSocketId === socket.id,
        hostSocketId: existingChannel.hostSocketId,
        locked: existingChannel.locked,
        state,
      });
      emitChannelState(safeChannel);
      return;
    }

    leaveCurrentChannel(socket);

    const channel = getOrCreateChannel(safeChannel);
    const connectedAt = Date.now();

    socket.data.username = safeUsername;
    socket.data.channelNumber = safeChannel;
    socket.join(safeChannel);

    channel.users.set(socket.id, {
      socketId: socket.id,
      username: safeUsername,
      joinedAt: connectedAt,
      connectedAt,
    });

    if (!channel.hostSocketId) channel.hostSocketId = socket.id;

    const existingPeers = [...channel.users.keys()].filter((id) => id !== socket.id);
    const state = channelPayload(safeChannel);

    ack?.({
      ok: true,
      socketId: socket.id,
      channel: safeChannel,
      channelNumber: safeChannel,
      users: channel.users.size,
      peers: existingPeers,
      isHost: channel.hostSocketId === socket.id,
      hostSocketId: channel.hostSocketId,
      locked: channel.locked,
      state,
    });

    socket.to(safeChannel).emit('peer:joined', {
      socketId: socket.id,
      username: safeUsername,
    });
    emitChannelState(safeChannel);
  });

  socket.on('channel:leave', (_payload, ack) => {
    leaveCurrentChannel(socket);
    ack?.({ ok: true });
  });

  socket.on('channel:set-lock', ({ locked }, ack) => {
    const channelNumber = socket.data.channelNumber;
    if (!channelNumber) {
      ack?.({ ok: false, error: 'Join a channel first.' });
      return;
    }

    const channel = getChannel(channelNumber);
    if (!channel) {
      ack?.({ ok: false, error: 'Channel no longer exists.' });
      return;
    }

    if (channel.hostSocketId !== socket.id) {
      ack?.({ ok: false, error: 'NOT_HOST' });
      return;
    }

    channel.locked = Boolean(locked);
    const state = channelPayload(channelNumber);
    ack?.({ ok: true, locked: channel.locked, state });
    emitChannelState(channelNumber);
  });

  socket.on('channel:end', (_payload, ack) => {
    const channelNumber = socket.data.channelNumber;
    if (!channelNumber) {
      ack?.({ ok: false, error: 'Join a channel first.' });
      return;
    }

    const channel = getChannel(channelNumber);
    if (!channel) {
      ack?.({ ok: false, error: 'Channel no longer exists.' });
      return;
    }

    if (channel.hostSocketId !== socket.id) {
      ack?.({ ok: false, error: 'NOT_HOST' });
      return;
    }

    io.to(channelNumber).emit('channel:ended', { 
      message: 'The host ended this channel session.' 
    });

    // Clean up channel state before disconnecting everyone
    channels.delete(channelNumber);

    // Get all sockets in the channel and make them leave it
    const sockets = io.sockets.adapter.rooms.get(channelNumber);
    if (sockets) {
      for (const socketId of sockets) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          s.leave(channelNumber);
          s.data.channelNumber = null;
        }
      }
    }

    ack?.({ ok: true });
  });

  socket.on('channel:remove-user', ({ targetSocketId }, ack) => {
    const channelNumber = socket.data.channelNumber;
    if (!channelNumber) {
      ack?.({ ok: false, error: 'Join a channel first.' });
      return;
    }

    const channel = getChannel(channelNumber);
    if (!channel) {
      ack?.({ ok: false, error: 'Channel no longer exists.' });
      return;
    }

    if (channel.hostSocketId !== socket.id) {
      ack?.({ ok: false, error: 'NOT_HOST' });
      return;
    }

    if (targetSocketId === socket.id) {
      ack?.({ ok: false, error: 'CANNOT_REMOVE_SELF' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket || !channel.users.has(targetSocketId)) {
      ack?.({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }

    // Notify target
    io.to(targetSocketId).emit('channel:removed', {
      message: 'You were removed from this channel by the host.'
    });

    // Clean up
    const wasTransmitting = channel.transmittingSocketId === targetSocketId;
    channel.users.delete(targetSocketId);
    targetSocket.leave(channelNumber);
    targetSocket.data.channelNumber = null;

    if (wasTransmitting) {
      channel.transmittingSocketId = null;
      io.to(channelNumber).emit('ptt:ended', { socketId: targetSocketId });
    }

    io.to(channelNumber).emit('peer:left', { socketId: targetSocketId });
    emitChannelState(channelNumber);

    ack?.({ ok: true });
  });

  socket.on('signal:offer', ({ to, description }) => {
    io.to(to).emit('signal:offer', { from: socket.id, description });
  });

  socket.on('signal:answer', ({ to, description }) => {
    io.to(to).emit('signal:answer', { from: socket.id, description });
  });

  socket.on('signal:ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('signal:ice-candidate', { from: socket.id, candidate });
  });

  socket.on('ptt:start', (_payload, ack) => {
    const channelNumber = socket.data.channelNumber;
    if (!channelNumber) {
      ack?.({ ok: false, error: 'Join a channel first.' });
      return;
    }

    const channel = getChannel(channelNumber);
    if (channel.transmittingSocketId && channel.transmittingSocketId !== socket.id) {
      ack?.({
        ok: false,
        busy: true,
        transmittingSocketId: channel.transmittingSocketId,
        transmittingUser: channel.users.get(channel.transmittingSocketId) || null,
      });
      return;
    }

    channel.transmittingSocketId = socket.id;
    ack?.({ ok: true });
    io.to(channelNumber).emit('ptt:started', {
      socketId: socket.id,
      username: socket.data.username,
    });
    emitChannelState(channelNumber);
  });

  socket.on('ptt:end', (_payload, ack) => {
    const channelNumber = socket.data.channelNumber;
    if (!channelNumber) {
      ack?.({ ok: true });
      return;
    }

    const channel = getChannel(channelNumber);
    if (channel.transmittingSocketId === socket.id) {
      channel.transmittingSocketId = null;
      io.to(channelNumber).emit('ptt:ended', { socketId: socket.id });
      emitChannelState(channelNumber);
    }
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const ip = getIpAddress(socket);
    decrementSocketCount(ip);
    console.log(`[Socket] Disconnected: ${socket.id} from ${ip} (remaining: ${getSocketCountForIp(ip)})`);
    leaveCurrentChannel(socket);
  });
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught Exception:', {
    message: err?.message,
    stack: err?.stack,
  });
  // Don't exit - log and continue for resilience
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  // Don't exit - log and continue for resilience
});

httpServer.listen(PORT, () => {
  console.log(`Walkie Talking signaling server running on port ${PORT}`);
  console.log(`Allowed client origins: ${CLIENT_ORIGINS.join(', ')}`);
});
