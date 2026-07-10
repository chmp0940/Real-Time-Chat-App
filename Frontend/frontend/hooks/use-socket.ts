"use client";

import { io, type Socket } from "socket.io-client";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

type UseSocketResult = {
  socket: Socket | null;
  connected: boolean;
};

export function useSocket(): UseSocketResult {
  const { userId, isLoaded } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!userId) {
      setConnected(false);
      setSocket((prev) => {
        if (prev) {
          prev.disconnect();
          ``;
        }
        return null;
      });
    }

    const baseUrl = "http://localhost:5000";

    console.log(`[Socket],${userId},${baseUrl}`);

    const socketInstance: Socket = io(baseUrl, {
      auth: { userId }, // this is where backend is going to read the userId
      withCredentials: true,
      transports: ["websocket"],
    });

    setSocket(socketInstance);

    const handleConnect = () => {
      console.log("Socket connected");
      setConnected(true);
    };

    const handleDisconnect = () => {
      console.log("Socket disconnected");
      setConnected(false);
    };

    const handleConnectError = (error: any) => {
      console.error("Socket connection error:", error);
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);
    socketInstance.on("connect_error", handleConnectError);

    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.off("connect_error", handleConnectError);
      socketInstance.disconnect();
      setConnected(false);
      setSocket(null);
    };
  }, [userId, isLoaded]);

  return { socket, connected };
}
