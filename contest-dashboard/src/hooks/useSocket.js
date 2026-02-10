import { useEffect, useRef, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../utils/socket';
import useStore from '../store/useStore';

/**
 * Connect to Socket.io on mount, disconnect on unmount.
 * Returns the socket instance and a helper to listen to events.
 */
export default function useSocket() {
  const socketRef = useRef(null);
  const addLiveAlert = useStore((s) => s.addLiveAlert);

  useEffect(() => {
    const s = connectSocket();
    socketRef.current = s;

    // Global listeners
    s.on('alert:new', (data) => {
      addLiveAlert(data);
    });

    return () => {
      s.off('alert:new');
      disconnectSocket();
    };
  }, [addLiveAlert]);

  const on = useCallback((event, handler) => {
    const s = getSocket();
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  return { socket: socketRef.current, on };
}
