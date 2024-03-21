import React from "react";
import { Text, ScrollView, Image } from "react-native";
import { useTailwind } from "nativewind";

import * as Application from "expo-application";

const AboutAppScreen = () => {
  const tailwind = useTailwind();
  const appVersion = Application.nativeApplicationVersion;

  return (
    <ScrollView style={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold text-center mb-4")}>
        About PetPalsConnect
      </Text>

      <Image
        source={{ uri: "image-url" }} // Replace with your app logo or relevant image
        style={tailwind("self-center w-40 h-40 mb-4")}
      />

      <Text style={tailwind("text-base")}>
        Welcome to PetPalsConnect, the ultimate social network for your furry
        friends! 🐾 Our app brings together pet lovers from all over, allowing
        your pets to find new friends, set up playdates, and explore
        pet-friendly places.
      </Text>

      <Text style={tailwind("text-base mt-4")}>
        Dive into a world where your pets take the lead. Share their adorable
        moments, schedule meetups, and discover a community that celebrates the
        joy pets bring into our lives. PetPalsConnect is more than an app;
        it&rsquo;s a paw-some journey! 🐕🐈
      </Text>

      <Text style={tailwind("text-base mt-4")}>
        Stay connected, stay engaged, and let your pets spread their joy and
        love. PetPalsConnect is where friendships begin, tales wag, and paws
        meet. Join us now and be a part of the most vibrant pet community! 🌟
      </Text>
      <Text style={tailwind("text-base mt-4")}>App Version: {appVersion}</Text>
    </ScrollView>
  );
};

export default AboutAppScreen;
