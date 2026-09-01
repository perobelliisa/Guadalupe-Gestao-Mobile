import AsyncStorage from "@react-native-async-storage/async-storage";

export async function salvarUsuario(id, nome, email) {
    await AsyncStorage.setItem("usuario", JSON.stringify({ id: id, nome: nome, email: email }));
}

export async function getUsuario() {
    var usuario = await AsyncStorage.getItem("usuario");

    if (!usuario || !usuario.length) {
        return false;
    }

    return usuario;
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
    await AsyncStorage.removeItem("usuario");
}
