import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Dimensions,
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  Text,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import axios from "axios";
import * as Location from "expo-location";
import { copilot, walkthroughable, CopilotStep } from "react-native-copilot";
import { useTailwind } from "nativewind";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import BottomSheet from "@gorhom/bottom-sheet";
import CustomTooltip from "../../components/CustomTooltip";
import { useNavigation } from "@react-navigation/native";

const WalkthroughableMapView = walkthroughable(MapView);
const WalkthroughableText = walkthroughable(Text);
const WalkthroughableTouchableOpacity = walkthroughable(TouchableOpacity);

const MapScreen = ({ start, route }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [matchedPets, setMatchedPets] = useState([]);
  const [showMatchedPets, setShowMatchedPets] = useState(true);
  const [showPlaydateLocations, setShowPlaydateLocations] = useState(true);
  const [playdateLocations, setPlaydateLocations] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapTheme, setMapTheme] = useState("standard");
  const tailwind = useTailwind();
  const bottomSheetRef = useRef(null);
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        Alert.alert(
          "Location Permission Denied",
          "Please enable location services to use the map."
        );
        return;
      }

      try {
        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
      } catch (error) {
        setErrorMsg("Error getting current location");
        Alert.alert(
          "Location Error",
          "There was an error getting your current location."
        );
      }

      // Fetch matched pets and playdate locations from the backend
      fetchMatchedPets();
      fetchPlaydateLocations();
    })();
    if (route.params?.showTutorial) {
      start(); // Start copilot tutorial
    }
  }, [route.params?.showTutorial]);

  const toggleMatchedPets = () => setShowMatchedPets(!showMatchedPets);
  const togglePlaydateLocations = () =>
    setShowPlaydateLocations(!showPlaydateLocations);

  const fetchMatchedPets = async () => {
    try {
      const response = await axios.get("/api/matched-pets");
      setMatchedPets(response.data);
    } catch (error) {
      console.error("Error fetching matched pets:", error);
    }
  };

  const fetchPlaydateLocations = async () => {
    try {
      const response = await axios.get("/api/playdate-locations");
      setPlaydateLocations(response.data);
    } catch (error) {
      console.error("Error fetching playdate locations:", error);
    }
  };

  const handleMarkerPress = (marker, type) => {
    setSelectedMarker({ ...marker, type }); // 'type' can be 'pet' or 'playdate'
    bottomSheetRef.current.show();
  };

  const toggleMapTheme = () => {
    setMapTheme(mapTheme === "standard" ? "night" : "standard");
  };

  // Default region to use if location is null
  const defaultRegion = {
    latitude: 37.78825, // Example coordinates (e.g., a central location in your area)
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  // Use user location or default if location is null
  const initialRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }
    : defaultRegion;

  const snapPoints = useMemo(() => [300, 0], []);

  useEffect(() => {
    start(); // Start the copilot tutorial
  }, [start]);

  const handleSheetChanges = useCallback((index) => {
    console.log("handleSheetChanges", index);
  }, []);
  return (
    <View style={styles.container}>
      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
      <CopilotStep
        text="This is your map where you can see all the matched pets and playdate spots."
        order={1}
        name="mapView"
      >
        <WalkthroughableMapView
          style={styles.map}
          initialRegion={initialRegion}
          provider={PROVIDER_GOOGLE}
          mapType={mapTheme}
        >
          {showMatchedPets &&
            matchedPets.map((pet) => (
              <Marker
                key={pet._id}
                coordinate={{
                  latitude: pet.location.lat,
                  longitude: pet.location.lng,
                }}
                title={pet.name}
                description={"Matched Pet"}
                onPress={() => handleMarkerPress(pet, "pet")}
              >
                <Icon name="dog" size={30} color="#2E8B57" />
              </Marker>
            ))}
          {showPlaydateLocations &&
            playdateLocations.map((playdate) => (
              <Marker
                key={playdate._id}
                coordinate={{
                  latitude: playdate.Location.lat,
                  longitude: playdate.Location.lng,
                }}
                title={playdate.name}
                description={"Playdate Spot"}
                onPress={() => handleMarkerPress(playdate, "playdate")}
              >
                <Icon name="paw" size={30} color="#FF6347" />
              </Marker>
            ))}
        </WalkthroughableMapView>
      </CopilotStep>
      <CopilotStep
        text="Tap here to switch between dark and light map modes."
        order={2}
        name="toggleTheme"
      ></CopilotStep>
      <WalkthroughableTouchableOpacity
        style={tailwind("absolute bottom-4 right-4 bg-white rounded-full p-2")}
        onPress={toggleMapTheme}
      >
        <Icon
          name={
            mapTheme === "standard"
              ? "moon-waning-crescent"
              : "white-balance-sunny"
          }
          size={24}
        />
      </WalkthroughableTouchableOpacity>
      {/* Toggle Buttons for Filters */}
      <View style={styles.filterContainer}>
        <CopilotStep
          text="Tap here to show or hide matched pets on the map."
          order={1}
          name="matchedPetsToggle"
        >
          <WalkthroughableTouchableOpacity
            style={tailwind("m-2 p-2 bg-blue-500 rounded")}
            onPress={toggleMatchedPets}
          >
            <WalkthroughableText style={tailwind("text-white")}>
              {showMatchedPets ? "Hide Matched Pets" : "Show Matched Pets"}
            </WalkthroughableText>
          </WalkthroughableTouchableOpacity>
        </CopilotStep>

        <CopilotStep
          text="Tap here to show or hide locations for playdates."
          order={2}
          name="playdatesToggle"
        >
          <WalkthroughableTouchableOpacity
            style={tailwind("m-2 p-2 bg-green-500 rounded")}
            onPress={togglePlaydateLocations}
          >
            <WalkthroughableText style={tailwind("text-white")}>
              {showPlaydateLocations ? "Hide Playdates" : "Show Playdates"}
            </WalkthroughableText>
          </WalkthroughableTouchableOpacity>
        </CopilotStep>
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enableContentPanningGesture={true}
        initialSnapIndex={1}
      >
        <View style={tailwind("p-4")}>
          {selectedMarker && (
            <>
              <CopilotStep
                text="Here are the details of your selection."
                order={3}
                name="markerDetails"
              >
                <WalkthroughableText style={tailwind("text-lg font-bold mb-2")}>
                  {selectedMarker.title}
                </WalkthroughableText>
              </CopilotStep>
              <WalkthroughableText style={tailwind("mb-4")}>
                {selectedMarker.description}
              </WalkthroughableText>
              <CopilotStep
                text="Tap here to view more details and take action."
                order={4}
                name="viewDetails"
              >
                <WalkthroughableTouchableOpacity
                  style={tailwind("bg-blue-500 py-2 px-4 rounded")}
                  onPress={() => {
                    if (selectedMarker.type === "pet") {
                      navigation.navigate("PetDetailsScreen", {
                        petId: selectedMarker._id,
                      });
                    } else if (selectedMarker.type === "playdate") {
                      navigation.navigate("PotentialPlaydateLocationScreen", {
                        playdateId: selectedMarker._id,
                      });
                    }
                    bottomSheetRef.current.close();
                  }}
                >
                  <WalkthroughableText
                    style={tailwind("text-white text-center")}
                  >
                    View Details
                  </WalkthroughableText>
                </WalkthroughableTouchableOpacity>
              </CopilotStep>
            </>
          )}
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  filterContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export default copilot({
  tooltipComponent: CustomTooltip,
})(MapScreen);
