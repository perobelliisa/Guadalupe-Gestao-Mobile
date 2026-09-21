import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export async function salvarUsuario(id, nome, email) {
    await AsyncStorage.setItem("usuario", JSON.stringify({ id: id, nome: nome, email: email }));
}

export async function getUsuario() {
    var usuario = await AsyncStorage.getItem("usuario");

    if (!usuario || !usuario.length) {
        return false;
    }

    return JSON.parse(usuario);
}

// O token fica no armazenamento seguro do celular. A senha não é salva.
export async function salvarToken(token) {
    await SecureStore.setItemAsync("token", token);
}

export async function getToken() {
    return await SecureStore.getItemAsync("token");
}

export async function liberarBiometria() {
    await AsyncStorage.setItem("biometriaLiberada", "true");
}

export async function getBiometriaLiberada() {
    var biometriaLiberada = await AsyncStorage.getItem("biometriaLiberada");

    if (biometriaLiberada !== "true") {
        return false;
    }

    return true;
}

export async function limparDados() {
    await SecureStore.deleteItemAsync("token");
    await AsyncStorage.removeItem("usuario");
    await AsyncStorage.removeItem("biometriaLiberada");
}
