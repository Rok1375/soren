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
  socket.emit('server:ready', { socketId: socket.id });

  socket.on('channel:join', ({ username, channelNumber }, ack) => {
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
    leaveCurrentChannel(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Walkie Talking signaling server running on port ${PORT}`);
  console.log(`Allowed client origins: ${CLIENT_ORIGINS.join(', ')}`);
});
