import React, { useState, useEffect, useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import api from "../../api/axios";
import { acceptPlaydate, declinePlaydate } from "../../api/playdates";
import LoadingScreen from "../../components/LoadingScreenComponent";
import UserPetCard from "../../components/UserPetCardComponent";
import ReviewComponent from "../../components/ReviewComponent";
import { Button, Text, useToast } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { space } from "../../styles/tokens";

const PlaydateDetailsScreen = ({ route, navigation }) => {
  const toast = useToast();
  const { userId } = useAuthSession();

  const [playdateDetails, setPlaydateDetails] = useState(null);
  const [responding, setResponding] = useState(false);

  const { playdateId } = route.params;

  const load = useCallback(async () => {
    try {
      const response = await api.get(`/api/playdates/${playdateId}`);
      setPlaydateDetails(response.data);
    } catch (error) {
      console.warn("[playdate] Could not load details:", error.message);
      toast.error("Couldn't load that playdate.");
    }
  }, [playdateId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * An invitation is answerable by an invitee, once.
   *
   * The server is what enforces that (`acceptPlaydate` refuses the organiser
   * and refuses a second answer); this only decides whether to *offer* the
   * choice, because a button that can only 403 is worse than no button. The
   * organiser sees the same screen without the pair.
   */
  const creatorId = playdateDetails?.creator?._id ?? playdateDetails?.creator;
  const isOrganiser = !!userId && String(creatorId) === String(userId);
  // Changing the plan is the organiser's to do, and only while it is still
  // ahead of everyone. `PlaydateModification` had no way in from anywhere.
  const canModify =
    isOrganiser && ["pending", "accepted"].includes(playdateDetails?.status);

  const canRespond =
    playdateDetails?.status === "pending" && !!userId && !isOrganiser;

  const respond = useCallback(
    async (action, done) => {
      setResponding(true);
      try {
        await action(playdateId);
        toast.success(done);
        await load();
      } catch (error) {
        toast.error(
          error?.response?.data?.message ?? "That didn't go through. Try again."
        );
      } finally {
        setResponding(false);
      }
    },
    [playdateId, load, toast]
  );

  if (!playdateDetails) {
    return <LoadingScreen />;
  }

  const navigateToPetDetails = (petId) => {
    navigation.navigate("PetDetails", { petId: petId });
  };

  return (
    <ScrollView style={styles.container}>
      {/* The pets are who is meeting; the owners are who is bringing them.
          This had the owners first under the heading "Participants", which
          made the playdate look like an appointment between two people. */}
      <Text variant="title">Who&apos;s meeting</Text>
      {playdateDetails.petsInvolved.map((pet) => (
        <UserPetCard
          key={pet._id}
          data={pet}
          type="pet"
          onPress={() => navigateToPetDetails(pet._id)}
        />
      ))}
      <Text variant="title">Coming along</Text>
      {playdateDetails.participants.map((user) => (
        <UserPetCard key={user._id} data={user} type="user" />
      ))}

      <Text variant="title">Playdate Details</Text>
      <Text>Date: {new Date(playdateDetails.date).toLocaleDateString()}</Text>
      {/* `getPlaydateById` nulls the location when the organiser has location
          sharing off, so reading `.name` here crashed for exactly the person
          the server was protecting. */}
      <Text>
        Location:{" "}
        {playdateDetails.location?.name ?? "Hidden until the organiser shares it"}
      </Text>
      {playdateDetails.notes ? <Text>Notes: {playdateDetails.notes}</Text> : null}

      {canRespond ? (
        <View style={styles.actions}>
          <Button
            title="Accept"
            onPress={() => respond(acceptPlaydate, "Playdate accepted")}
            loading={responding}
            disabled={responding}
          />
          <View style={styles.actionGap} />
          <Button
            title="Decline"
            variant="secondary"
            onPress={() => respond(declinePlaydate, "Playdate declined")}
            disabled={responding}
          />
        </View>
      ) : null}

      {canModify ? (
        <View style={styles.actions}>
          <Button
            title="Change the plan"
            variant="secondary"
            onPress={() =>
              navigation.navigate("PlaydateModification", { playdateId })
            }
          />
          <View style={styles.actionGap} />
          {/* The confirmation screen collects a reason and tells everyone
              invited; it had no way in from anywhere either. */}
          <Button
            title="Cancel this playdate"
            variant="danger"
            onPress={() =>
              navigation.navigate("PlaydateCancellationConfirmation", {
                playdateId,
              })
            }
          />
        </View>
      ) : null}

      {playdateDetails.reviews?.length ? (
        <>
          <Text variant="title">Reviews</Text>
          {playdateDetails.reviews.map((review) => (
            <ReviewComponent key={review._id} reviewData={review} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: space.md,
  },
  actions: {
    marginTop: space.lg,
    marginBottom: space.md,
  },
  actionGap: {
    height: space.sm,
  },
});

export default PlaydateDetailsScreen;
