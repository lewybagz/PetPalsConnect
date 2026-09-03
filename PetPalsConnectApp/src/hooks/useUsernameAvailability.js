import { useEffect, useRef, useState } from "react";

import api from "../api/axios";

/**
 * Live username availability, debounced.
 *
 * Checking as someone types means they learn a name is taken while they can
 * still change it, rather than after the Firebase account already exists and
 * the profile call comes back 409.
 *
 * The server is the authority on both format and availability, so the rules
 * live in one place (backend/services/usernames.js) and cannot drift out of
 * step with what signup will actually accept.
 */
export default function useUsernameAvailability(username, { delay = 450 } = {}) {
  const [state, setState] = useState({ status: "idle", reason: null });

  // Only the newest response may update state.
  const requestId = useRef(0);

  useEffect(() => {
    const candidate = username.trim();

    if (!candidate) {
      setState({ status: "idle", reason: null });
      return undefined;
    }

    setState({ status: "checking", reason: null });

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/api/users/username-available", {
          params: { username: candidate },
        });
        if (id !== requestId.current) return;

        setState({
          status: data.available ? "available" : "unavailable",
          reason: data.reason ?? null,
        });
      } catch {
        if (id !== requestId.current) return;
        // Offline or the API is down. Don't block the user - let them submit
        // and let the unique index be the final word.
        setState({ status: "unknown", reason: null });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [username, delay]);

  return state;
}
