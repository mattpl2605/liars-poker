import { io, Socket } from 'socket.io-client';

// Use environment variable in production; fallback to localhost during development.
const URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'
    : '';
let socket: Socket | null = null;

export function getSocket() {
  if (!socket && URL) {
   socket = io(URL, { transports: ['websocket'] });   // <- too strict
   socket = io(URL, {
     transports: ['websocket', 'polling'], // allow fallback, then upgrade
     secure: true                          // tells client to use wss://
   });
  }
  return socket;
}