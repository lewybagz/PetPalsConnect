// src/hooks/useSocketFriendRequest.js
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import io from "socket.io-client";

const socket = io("http://your-server-address.com");

export const useSocketFriendRequest = (updateFriendList) => {
  const dispatch = useDispatch();

  useEffect(() => {
    socket.on("friendRequest", (friendRequest) => {
      // Assuming you have an action to add a friend request
      dispatch({ type: "ADD_FRIEND_REQUEST", payload: friendRequest });

      // Call the passed function to update the local friend list state
      updateFriendList(friendRequest);
    });

    return () => {
      socket.off("friendRequest");
    };
  }, [dispatch, updateFriendList]);
};
