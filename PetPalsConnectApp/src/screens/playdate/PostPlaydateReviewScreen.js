import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";

import api from "../../api/axios";
import StarRating from "../../components/StarRating";
import PlayDateLocationCard from "../../components/PlaydateLocationCardComponent";
import { Button, Card, Screen, Text, Toggle, useToast } from "../../components/ui";
import { useTailwind } from "../../styles/tailwind";
import { useTokens } from "../../context/AppThemeContext";
import { radius } from "../../styles/tokens";

/**
 * How was the playdate?
 *
 * No review has ever been submitted from here. The payload was
 * `{ Comment, Rating, RelatedPlaydate, Reviewer, Visibility }` - PascalCase
 * against a lowercase schema, so Mongoose strict mode dropped every key and
 * the save failed on `comment` and `rating`, both required and both visibly
 * present two lines above. `backend/test/types.test.js` fails on that shape
 * now, in either direction.
 *
 * `Reviewer` was also resolved with an extra round trip to
 * `/api/pets/owner/:id` to find out who was writing the review; the server
 * takes that from the token.
 *
 * The visibility switch called the API immediately, before a review existed,
 * so touching it always answered "Review ID is not available." It is part of
 * the review now and goes with it.
 */
const PostPlaydateReviewScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const tokens = useTokens();
  const toast = useToast();

  const playdateId = route?.params?.playdateId ?? route?.params?.playdate?._id;
  const playdate = route?.params?.playdate ?? null;
  const pet = route?.params?.pet ?? null;

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [locationData, setLocationData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const locationId = playdate?.location?._id ?? playdate?.location ?? null;

  useEffect(() => {
    if (!locationId) return undefined;

    let cancelled = false;
    api
      .get(`/api/locations/${locationId}`)
      .then(({ data }) => {
        if (!cancelled) setLocationData(data);
      })
      .catch((error) =>
        console.warn("[reviews] Could not load the location:", error.message)
      );

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const submit = useCallback(async () => {
    if (rating === 0) {
      toast.error("Give the playdate a rating first.");
      return;
    }
    if (!comment.trim()) {
      toast.error("A few words help the next person choose.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/reviews", {
        comment: comment.trim(),
        rating,
        relatedPlaydate: playdateId,
        relatedLocation: locationId,
        visibility: isPublic,
      });

      toast.success("Thanks — review posted");
      navigation.navigate("Home");
    } catch (error) {
      console.warn("[reviews] Could not submit:", error.message);
      toast.error("Couldn't post that review. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [comment, isPublic, locationId, navigation, playdateId, rating, toast]);

  return (
    <Screen testID="post-playdate-review">
      <ScrollView showsVerticalScrollIndicator={false}>
        {pet?.name ? (
          <Card style={tailwind("mb-lg")}>
            <Text variant="label">{pet.name}</Text>
            {pet.breed ? (
              <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
                {pet.breed}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {locationData ? (
          <PlayDateLocationCard
            locationData={locationData}
            navigation={navigation}
          />
        ) : null}

        <Text variant="title" style={tailwind("mt-lg")}>
          How did it go?
        </Text>

        <View style={tailwind("items-center my-lg")}>
          <StarRating
            disabled={submitting}
            maxStars={5}
            rating={rating}
            selectedStar={setRating}
          />
        </View>

        <Text variant="caption" tone="muted" style={tailwind("mb-sm")}>
          Your feedback
        </Text>
        <TextInput
          testID="review-comment"
          style={[
            tailwind("bg-surface border border-border text-text p-md"),
            { borderRadius: radius.control, minHeight: 110, textAlignVertical: "top" },
          ]}
          placeholder="What was it like?"
          placeholderTextColor={tokens.textFaint}
          value={comment}
          onChangeText={setComment}
          editable={!submitting}
          multiline
        />

        <View style={tailwind("flex-row items-center justify-between mt-lg")}>
          <View style={tailwind("flex-1 pr-lg")}>
            <Text variant="body">Show this publicly</Text>
            <Text variant="caption" tone="muted" style={tailwind("mt-xs")}>
              Public reviews appear on the place you met.
            </Text>
          </View>
          <Toggle
            testID="review-visibility"
            accessibilityLabel="Show this review publicly"
            value={isPublic}
            disabled={submitting}
            onValueChange={setIsPublic}
          />
        </View>

        <Button
          testID="review-submit"
          title="Post review"
          onPress={submit}
          loading={submitting}
          style={tailwind("mt-xl")}
        />
      </ScrollView>
    </Screen>
  );
};

export default PostPlaydateReviewScreen;
