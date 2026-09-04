import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTailwind } from "../../styles/tailwind";
import { RequiresPet } from "../../components/RequiresPet";
import {
  decide,
  describeDistance,
  describeScore,
  fetchCandidates,
  topReasons,
} from "../../api/discovery";

/**
 * Browse pets and say yes or no. This is the app's core loop, and it did not
 * exist: the matching engine ranked pets and stored the results, but no screen
 * ever asked for them, there was no tab to reach one, and there was no way to
 * express interest. Everything downstream - chat, playdates - starts here.
 *
 * The card leads with *why* two pets matched rather than a bare percentage.
 * "Similar size, likes the same things" is something an owner can agree with;
 * "78%" is not.
 */

const petPhoto = (pet) =>
  (Array.isArray(pet?.photos) ? pet.photos[0] : null) ?? null;

const Stat = ({ tailwind, label, value }) =>
  value == null || value === "" ? null : (
    <View style={tailwind("mr-6")}>
      <Text style={tailwind("text-xs text-gray-500")}>{label}</Text>
      <Text style={tailwind("text-base font-semibold text-gray-900")}>
        {value}
      </Text>
    </View>
  );

const DiscoverContent = ({ navigation }) => {
  const tailwind = useTailwind();

  const [myPet, setMyPet] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [threshold, setThreshold] = useState(0);
  const [range, setRange] = useState(null);
  const [locationKnown, setLocationKnown] = useState(false);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [match, setMatch] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchCandidates();
      setMyPet(result.pet);
      setCandidates(result.candidates);
      setThreshold(result.threshold);
      setRange(result.range);
      setLocationKnown(result.locationKnown);
      setIndex(0);
    } catch (error) {
      console.warn("[discover]", error.message);
      Alert.alert("Error", "Could not load matches. Pull to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const current = candidates[index];

  const submit = async (decision) => {
    if (!current || !myPet || deciding) return;

    setDeciding(true);
    // Advance immediately: waiting on the network before showing the next card
    // makes the whole screen feel broken on a slow connection.
    setIndex((position) => position + 1);

    try {
      const result = await decide({
        fromPetId: myPet._id,
        toPetId: current.pet._id,
        decision,
      });
      if (result?.mutual) setMatch(result.matchedPet);
    } catch (error) {
      console.warn("[discover] decide failed:", error.message);
      Alert.alert("Error", "That didn't save. Please try again.");
      setIndex((position) => Math.max(0, position - 1));
    } finally {
      setDeciding(false);
    }
  };

  // Rendered next to *every* branch, not inside the card: deciding on the last
  // candidate flips the screen to its empty state, and a match modal declared
  // after that early return would never appear - which is exactly when a match
  // is most likely, since it is the card you just acted on.
  const matchModal = (
    <Modal visible={Boolean(match)} transparent animationType="fade">
      <View
        style={tailwind(
          "flex-1 bg-black bg-opacity-60 items-center justify-center p-8",
        )}
      >
        <View
          testID="discover-match"
          style={tailwind("bg-white rounded-3xl p-8 items-center w-full")}
        >
          <Ionicons name="heart" size={48} color="#2563eb" />
          <Text style={tailwind("text-2xl font-bold mt-3 text-center")}>
            It&apos;s a match!
          </Text>
          <Text style={tailwind("text-base text-gray-600 mt-2 text-center")}>
            {myPet?.name} and {match?.name} both said yes.
          </Text>

          <TouchableOpacity
            testID="discover-say-hello"
            onPress={() => {
              const matched = match;
              setMatch(null);
              navigation.navigate("Chat", { pet: matched });
            }}
            style={tailwind("bg-blue-600 rounded-xl px-6 py-3 mt-6 w-full")}
          >
            <Text style={tailwind("text-white font-semibold text-center")}>
              Say hello
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="discover-keep-browsing"
            onPress={() => setMatch(null)}
            style={tailwind("py-4")}
          >
            <Text style={tailwind("text-gray-500")}>Keep browsing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View
        testID="discover-loading"
        style={tailwind("flex-1 items-center justify-center")}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!current) {
    return (
      <View
        testID="discover-empty"
        style={tailwind("flex-1 items-center justify-center px-8")}
      >
        <Ionicons name="paw-outline" size={56} color="#d0d0d0" />
        <Text
          style={tailwind("text-xl font-bold text-gray-900 mt-5 text-center")}
        >
          That&apos;s everyone for now
        </Text>
        <Text style={tailwind("text-base text-gray-500 mt-2 text-center")}>
          {range == null
            ? "New pets join all the time. Check back soon."
            : `Nobody new within ${range} miles. Widen your range in Settings, or check back soon.`}
        </Text>
        {!locationKnown ? (
          <Text
            testID="discover-location-hint"
            style={tailwind("text-sm text-gray-400 mt-3 text-center")}
          >
            Sharing your location lets us show pets you could actually meet.
          </Text>
        ) : null}
        <TouchableOpacity
          testID="discover-refresh"
          onPress={load}
          style={tailwind("mt-6 bg-blue-600 rounded-xl px-6 py-3")}
        >
          <Text style={tailwind("text-white font-semibold")}>Refresh</Text>
        </TouchableOpacity>
        {matchModal}
      </View>
    );
  }

  const reasons = topReasons(current.breakdown);

  return (
    <View testID="discover-card" style={tailwind("flex-1 p-4")}>
      <Text style={tailwind("text-sm text-gray-500 mb-2")}>
        Matches for {myPet?.name}
      </Text>

      <View
        style={tailwind(
          "flex-1 bg-white rounded-3xl border border-gray-200 overflow-hidden",
        )}
      >
        {petPhoto(current.pet) ? (
          <Image
            source={{ uri: petPhoto(current.pet) }}
            style={tailwind("w-full h-64")}
          />
        ) : (
          <View
            style={tailwind(
              "w-full h-64 bg-gray-100 items-center justify-center",
            )}
          >
            <Ionicons name="paw-outline" size={48} color="#9ca3af" />
          </View>
        )}

        <View style={tailwind("p-5 flex-1")}>
          <View style={tailwind("flex-row items-center justify-between")}>
            <Text style={tailwind("text-2xl font-bold text-gray-900")}>
              {current.pet.name}
            </Text>
            <View style={tailwind("bg-blue-50 rounded-full px-3 py-1")}>
              <Text
                testID="discover-score"
                style={tailwind("text-xs font-semibold text-blue-700")}
              >
                {describeScore(current.score, threshold)}
              </Text>
            </View>
          </View>

          {describeDistance(current.distanceMiles) ? (
            <Text
              testID="discover-distance"
              style={tailwind("text-sm text-gray-500 mt-1")}
            >
              {describeDistance(current.distanceMiles)}
            </Text>
          ) : null}

          <View style={tailwind("flex-row mt-4")}>
            <Stat tailwind={tailwind} label="Breed" value={current.pet.breed} />
            <Stat
              tailwind={tailwind}
              label="Age"
              value={current.pet.age != null ? `${current.pet.age}` : null}
            />
            <Stat
              tailwind={tailwind}
              label="Weight"
              value={
                current.pet.weight != null ? `${current.pet.weight} lb` : null
              }
            />
          </View>

          {reasons.length > 0 ? (
            <View style={tailwind("mt-5")}>
              {reasons.map((reason) => (
                <View
                  key={reason}
                  style={tailwind("flex-row items-center mb-1")}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                  <Text style={tailwind("text-base text-gray-700 ml-2")}>
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            testID="discover-details"
            onPress={() =>
              navigation.navigate("PetDetails", { petId: current.pet._id })
            }
            style={tailwind("mt-auto")}
          >
            <Text style={tailwind("text-blue-600")}>See full profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={tailwind("flex-row justify-center items-center py-5")}>
        <TouchableOpacity
          testID="discover-pass"
          disabled={deciding}
          onPress={() => submit("pass")}
          style={tailwind(
            "h-16 w-16 rounded-full border border-gray-300 items-center justify-center mr-8",
          )}
        >
          <Ionicons name="close" size={28} color="#6b7280" />
        </TouchableOpacity>

        <TouchableOpacity
          testID="discover-like"
          disabled={deciding}
          onPress={() => submit("like")}
          style={tailwind(
            "h-16 w-16 rounded-full bg-blue-600 items-center justify-center",
          )}
        >
          <Ionicons name="heart" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {matchModal}
    </View>
  );
};

/**
 * Matching starts from a pet's profile, so this is one of the screens that
 * genuinely cannot work without one - hence the wrapper rather than an inline
 * `pets.length === 0` branch.
 */
const DiscoverScreen = (props) => (
  <RequiresPet
    title="Add a pet to start matching"
    message="Matching compares your pet's size, temperament and favourite activities. Add one and we'll find their people."
  >
    <DiscoverContent {...props} />
  </RequiresPet>
);

export default DiscoverScreen;
