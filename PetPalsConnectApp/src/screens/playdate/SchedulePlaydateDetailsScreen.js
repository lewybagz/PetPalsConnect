import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";
import DateTimePickerComponent from "../../components/DateTimePickerComponent";
import { clearError } from "../../redux/actions";
import { useSelector, useDispatch } from "react-redux";
import { createPlaydate } from "../../api/playdates";
import { useTokens } from "../../context/AppThemeContext";
import { useToast } from "../../components/ui";

/**
 * The last step of arranging a playdate.
 *
 * The payload was `{ Date, Location, Notes, Participants, PetsInvolved,
 * Creator }` - PascalCase against a lowercase schema, so strict mode dropped
 * every key and the save failed on the fields that look present two lines
 * above. It also sent `Participants: [userId]`, just the organiser, and
 * `Creator` from the client, both of which the server derives itself; and it
 * had two pickers writing to the same `date` state, so the time picker
 * overwrote the date and vice versa.
 *
 * `src/api/playdates.js` already knew how to do this correctly - it combines
 * the two pickers and sends `startTime`, which the schema requires.
 */
const SchedulePlaydateDetailsScreen = ({ route, navigation }) => {
  const tokens = useTokens();
  const toast = useToast();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  const dispatch = useDispatch();
  const error = useSelector((state) => state.user.error);
  const { petId, locationId } = route.params;
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch, toast]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const playdate = await createPlaydate({
        date,
        time,
        locationId,
        petIds: [petId],
        notes,
      });

      navigation.navigate("PlaydateCreated", { playdate });
    } catch (submitError) {
      console.warn("[playdates] Could not create:", submitError.message);
      toast.error(
        submitError.response?.data?.message ??
          "Couldn't schedule that playdate. Try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lets Get Down To Details</Text>
      {/* Both pickers wrote to the same state, so choosing a time reset the
          date and choosing a date reset the time. */}
      <DateTimePickerComponent date={date} onDateChange={setDate} mode="date" />
      <DateTimePickerComponent date={time} onDateChange={setTime} mode="time" />
      <TextInput
        style={styles.input}
        placeholder="Notes for the playdate"
        multiline
        numberOfLines={4}
        onChangeText={setNotes}
        value={notes}
      />
      <Button
        title={submitting ? "Scheduling…" : "Submit Playdate"}
        disabled={submitting}
        onPress={handleSubmit}
      />
    </View>
  );
};

const makeStyles = (t) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    color: t.text,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    borderColor: t.textMuted,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});

export default SchedulePlaydateDetailsScreen;
