import { Server } from 'socket.io';

let io: Server | null = null;

export const attachIo = (server: Server) => {
  io = server;
};

/** Fire-and-forget broadcast; safe to call before the socket server is up. */
export const emit = (event: string, payload: unknown) => {
  io?.emit(event, payload);
};

export const emitTo = (room: string, event: string, payload: unknown) => {
  io?.to(room).emit(event, payload);
};
