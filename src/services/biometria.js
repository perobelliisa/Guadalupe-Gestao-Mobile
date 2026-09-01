import * as LocalAuthentication from "expo-local-authentication";

export async function getBiometria() {
    const possuiBiometria = await LocalAuthentication.hasHardwareAsync();

    if (!possuiBiometria) {
        console.log("O celular não possui biometria");
        return false;
    }

    const biometriaCadastrada = await LocalAuthentication.isEnrolledAsync();

    if (!biometriaCadastrada) {
        console.log("Não possui biometria cadastrada");
        return false;
    }

    const resultado = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirme sua identidade", cancelLabel: "Cancelar" });

    if (!resultado.success) {
        console.log("Biometria não validada!");
        return false;
    }

    console.log("Biometria validada!");
    return true;
}
