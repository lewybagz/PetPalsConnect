import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { useAuthSession } from "../context/AuthSessionContext";
import { setUser, setUserId } from "../redux/actions";

/**
 * Mirrors the signed-in profile into the Redux store.
 *
 * `AuthSessionContext` owns the profile, but fifteen screens and components
 * read `state.user.userId` from Redux - ChatScreen's "is this mine?" check,
 * NotificationsScreen's fetch, PetDetails, PetList and five playdate screens -
 * and *nothing anywhere dispatched it*. The slice existed, the field existed,
 * and it was `null` for the entire life of the app: messages all rendered as
 * the other person's, and `/api/notifications/user/null` was a real request
 * this app made.
 *
 * The store contract test could not catch it either - it checks that the field
 * a selector reads exists on the store, not that anything ever fills it in.
 *
 * Rather than convert fifteen screens to the context (a much larger diff, and
 * one that would have to be redone when they are typed), the session pushes
 * into the store at the root and both sources agree.
 */
const useSessionStore = () => {
  const dispatch = useDispatch();
  const { profile, userId } = useAuthSession();

  useEffect(() => {
    dispatch(setUserId(userId ?? null));
  }, [dispatch, userId]);

  useEffect(() => {
    dispatch(setUser(profile ?? null));
  }, [dispatch, profile]);
};

export default useSessionStore;
