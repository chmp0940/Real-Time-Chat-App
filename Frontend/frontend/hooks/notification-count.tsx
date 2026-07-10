"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type NotificationCountContextValue = {
  unreadCount: number;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  incrementUnreadCount: (val?: number) => void;
  decrementUnreadCount: (val?: number) => void;
};

const NotificationCountContext =
  createContext<NotificationCountContextValue | null>(null);

export function NotificationCountProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const incrementUnreadCount = useCallback((val: number = 1) => {
    if (val < 0) return;
    setUnreadCount((prev) => prev + val);
  }, []);

  const decrementUnreadCount = useCallback((val: number = 1) => {
    if (val < 0) return;
    setUnreadCount((prev) => Math.max(prev - val, 0));
  }, []);

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
      incrementUnreadCount,
      decrementUnreadCount,
    }),
    [unreadCount],
  );

  return (
    <NotificationCountContext.Provider value={value}>
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount() {
  const context = useContext(NotificationCountContext);
  if (!context) {
    throw new Error(
      "useNotificationCount must be used within a NotificationCountProvider",
    );
  }
  return context;
}
