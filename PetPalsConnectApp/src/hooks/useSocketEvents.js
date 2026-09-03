import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import { joinUserRoom, onSocketEvent } from "../services/socket";
import { useAuthSession } from "../context/AuthSessionContext";
import { addNotification } from "../redux/actions";

/**
 * Subscriptions to the server's realtime events.
 *
 * These replace `useSocketNotification` and `useSocketFriendRequest`, both of
 * which connected to a placeholder domain (see `services/socket.js`) and had a
 * second, quieter problem: the names did not line up with what the server
 * sends. The server emits "message" when a chat message is written; the chat
 * screens listened for "notification", and nothing emitted "notification" or
 * "friendRequest" at all. Even against the right host, nothing would have
 * arrived.
 *
 * Cleanup is per-listener. The old hooks called `socket.off("notification")`,
 * which removes *every* handler for that event, so two screens mounted at once
 * silently unsubscribed each other.
 */

/**
 * Subscribes for the life of the component, without resubscribing when the
 * caller passes a fresh arrow function on every render - which every caller
 * does. The handler is read through a ref so the listener is registered once.
 */
const useSocketListener = (event, handler) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(
    () => onSocketEvent(event, (payload) => handlerRef.current?.(payload)),
    [event]
  );
};

/** Joins the signed-in user's room so the server can reach this device. */
export const useSocketSession = () => {
  const { userId } = useAuthSession();

  useEffect(() => {
    joinUserRoom(userId);
  }, [userId]);
};

/** Calls `onMessage` for each chat message addressed to this user. */
export const useSocketMessage = (onMessage) => {
  useSocketListener("message", onMessage);
};

/**
 * Puts incoming notifications into the store, and hands them to a screen
 * keeping its own list.
 */
export const useSocketNotification = (onNotification) => {
  const dispatch = useDispatch();
  const handlerRef = useRef(onNotification);

  useEffect(() => {
    handlerRef.current = onNotification;
  }, [onNotification]);

  useEffect(
    () =>
      onSocketEvent("notification", (notification) => {
        dispatch(addNotification(notification));
        handlerRef.current?.(notification);
      }),
    [dispatch]
  );
};

/** Calls `onFriendRequest` when someone sends this user a friend request. */
export const useSocketFriendRequest = (onFriendRequest) => {
  useSocketListener("friendRequest", onFriendRequest);
};
