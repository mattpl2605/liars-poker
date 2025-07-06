import { io, Socket } from 'socket.io-client';

// Use environment variable in production; fallback to localhost during development.
const URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'
    : '';
let socket: Socket | null = null;

export function getSocket() {
  if (!socket && URL) {
    // No 'transports' array -> default = polling, then it upgrades to WS
    socket = io(URL, { secure: true });
  }
  return socket;
}