// src/hooks/useSocketNotification.js
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import io from "socket.io-client";

const socket = io("http://your-server-address.com");

export const useSocketNotification = (setNotifications) => {
  const dispatch = useDispatch();

  useEffect(() => {
    socket.on("notification", (notification) => {
      dispatch({ type: "ADD_NOTIFICATION", payload: notification });
      setNotifications((prevNotifications) => [
        notification,
        ...prevNotifications,
      ]);
    });

    return () => {
      socket.off("notification");
    };
  }, [dispatch, setNotifications]);
};
