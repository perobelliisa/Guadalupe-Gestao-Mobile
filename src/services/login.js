import { liberarBiometria, salvarUsuario } from "./usuarioStorage";

export async function realizarLogin(email, senha) {
    // Futuramente, este login fixo deverá ser substituído pela API real.
    if (email !== "missaoguadalupe@gmail.com" || senha !== "@Guimari2009") {
        throw new Error("E-mail ou senha informados estão incorretos.");
    }

    await salvarUsuario(1, "Missão Guadalupe", email);
    await liberarBiometria();
    return true;
}
