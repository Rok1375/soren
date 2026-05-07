import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT || 3001);
const DEFAULT_CLIENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

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

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'Walkie Talking signaling server' });
});

const httpServer = http.createServer(app);
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

function getChannel(channelNumber) {
  const key = channelNumber;
  if (!channels.has(key)) {
    channels.set(key, {
      users: new Map(),
      transmittingSocketId: null,
    });
  }
  return channels.get(key);
}

function channelPayload(channelNumber) {
  const channel = getChannel(channelNumber);
  return {
    channelNumber,
    onlineCount: channel.users.size,
    users: [...channel.users.values()],
    transmittingSocketId: channel.transmittingSocketId,
    transmittingUser: channel.transmittingSocketId
      ? channel.users.get(channel.transmittingSocketId) || null
      : null,
  };
}

function emitChannelState(channelNumber) {
  io.to(channelNumber).emit('channel:state', channelPayload(channelNumber));
}

function leaveCurrentChannel(socket) {
  const channelNumber = socket.data.channelNumber;
  if (!channelNumber) return;

  const channel = getChannel(channelNumber);
  const wasTransmitting = channel.transmittingSocketId === socket.id;

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
    emitChannelState(channelNumber);
  }

  socket.data.channelNumber = null;
  socket.data.username = null;
}

io.on('connection', (socket) => {
  socket.emit('server:ready', { socketId: socket.id });

  socket.on('channel:join', ({ username, channelNumber }, ack) => {
    const safeUsername = String(username || 'Operator').trim().slice(0, 24) || 'Operator';
    const channelValidation = validateChannel(channelNumber);

    if (!channelValidation.ok) {
      ack?.({ ok: false, error: channelValidation.error });
      return;
    }

    const safeChannel = channelValidation.value;

    leaveCurrentChannel(socket);

    socket.data.username = safeUsername;
    socket.data.channelNumber = safeChannel;
    socket.join(safeChannel);

    const channel = getChannel(safeChannel);
    channel.users.set(socket.id, {
      socketId: socket.id,
      username: safeUsername,
      joinedAt: Date.now(),
    });

    const existingPeers = [...channel.users.keys()].filter((id) => id !== socket.id);

    ack?.({
      ok: true,
      socketId: socket.id,
      channelNumber: safeChannel,
      peers: existingPeers,
      state: channelPayload(safeChannel),
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
    leaveCurrentChannel(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Walkie Talking signaling server running on port ${PORT}`);
  console.log(`Allowed client origins: ${CLIENT_ORIGINS.join(', ')}`);
});
