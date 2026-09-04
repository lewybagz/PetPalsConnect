import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { useToast } from "../../components/ui";
import { fetchBlocked, unblockUser } from "../../api/safety";
import { useTokens } from "../../context/AppThemeContext";

/**
 * Who you have blocked, and how to undo it.
 *
 * A block you cannot see is a block you cannot take back. There was no screen
 * for this at all - blocking was a menu item with no record and no reverse,
 * which is also the half of it both app stores check for.
 */
const BlockedAccountsScreen = () => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setBlocked(await fetchBlocked());
    } catch (error) {
      console.warn("[safety]", error.message);
      toast.error("Could not load your blocked accounts.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = (entry) => {
    const who = entry.blockedUser?.username ?? "this person";

    Alert.alert(`Unblock ${who}?`, "They'll be able to find and message you again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: async () => {
          const id = entry.blockedUser?._id;
          setBusyId(id);
          const previous = blocked;
          setBlocked((current) => current.filter((row) => row._id !== entry._id));

          try {
            await unblockUser(id);
          } catch (error) {
            setBlocked(previous);
            toast.error(error.response?.data?.message ?? "Could not unblock them.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        testID="blocked-loading"
        style={tailwind("flex-1 items-center justify-center")}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView testID="blocked-accounts" contentContainerStyle={tailwind("p-4")}>
      <Text style={tailwind("text-sm text-textMuted mb-4")}>
        Blocked accounts can&apos;t see you in matches or search, and neither of
        you can message the other.
      </Text>

      {blocked.length === 0 ? (
        <View
          testID="blocked-empty"
          style={tailwind("items-center justify-center py-16")}
        >
          <Ionicons name="shield-checkmark-outline" size={44} color={tokens.textFaint} />
          <Text style={tailwind("text-base text-textMuted mt-3")}>
            You haven&apos;t blocked anyone.
          </Text>
        </View>
      ) : (
        blocked.map((entry) => (
          <View
            key={entry._id}
            testID={`blocked-${entry.blockedUser?._id}`}
            style={tailwind(
              "flex-row items-center bg-surface border border-border rounded-2xl p-3 mb-3"
            )}
          >
            {entry.blockedUser?.userPhoto ? (
              <Image
                source={{ uri: entry.blockedUser.userPhoto }}
                style={tailwind("h-12 w-12 rounded-full")}
              />
            ) : (
              <View
                style={tailwind(
                  "h-12 w-12 rounded-full bg-surfaceAlt items-center justify-center"
                )}
              >
                <Ionicons name="person-outline" size={22} color={tokens.textFaint} />
              </View>
            )}

            <Text style={tailwind("flex-1 text-base font-semibold ml-3")}>
              {entry.blockedUser?.username ?? "Someone"}
            </Text>

            <TouchableOpacity
              testID={`unblock-${entry.blockedUser?._id}`}
              disabled={busyId === entry.blockedUser?._id}
              onPress={() => unblock(entry)}
              style={tailwind("border border-border rounded-xl px-4 py-2")}
            >
              <Text style={tailwind("font-semibold text-textMuted")}>Unblock</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default BlockedAccountsScreen;
