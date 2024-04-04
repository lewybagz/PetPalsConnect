import Realm from "realm";

class NavigationState extends Realm.Object {}

NavigationState.schema = {
  name: "NavigationState",
  primaryKey: "id",
  properties: {
    id: "int",
    state: "string",
  },
};

export default NavigationState;
