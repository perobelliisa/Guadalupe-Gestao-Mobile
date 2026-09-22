import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "./src/screens/Login/Login";
import Home from "./src/screens/Home/Home";
import Movimentacoes from "./src/screens/Movimentacoes/Movimentacoes";
import NovaMovimentacao from "./src/screens/Movimentacoes/NovaMovimentacao";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Movimentacoes" component={Movimentacoes} />
          <Stack.Screen name="NovaMovimentacao" component={NovaMovimentacao} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
