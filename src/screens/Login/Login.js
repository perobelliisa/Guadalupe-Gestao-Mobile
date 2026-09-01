import { Image, KeyboardAvoidingView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import Botao from "../../components/Botao";
import CampoTexto from "../../components/CampoTexto";
import { getBiometria } from "../../services/biometria";
import { realizarLogin } from "../../services/login";
import { getBiometriaLiberada, salvarUsuario } from "../../services/usuarioStorage";
import css from "./LoginStyle";

export default function Login({ navigation }) {
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(false);

    async function entrar() {
        setErro("");

        if (!email || !senha) {
            setErro("Preencha e-mail e senha.");
            return;
        }

        setCarregando(true);

        try {
            await realizarLogin(email.trim(), senha);
            setCarregando(false);
            navigation.replace("Home");
            return;
        } catch (erroLogin) {
            setCarregando(false);
            setErro(erroLogin.message);
            return;
        }
    }

    async function entrarComBiometria() {
        setErro("");
        setCarregando(true);

        try {
            var biometriaLiberada = await getBiometriaLiberada();

            if (!biometriaLiberada) {
                setCarregando(false);
                setErro("Faça o login com e-mail e senha antes de usar a biometria.");
                return;
            }

            var resultado = await getBiometria();

            if (!resultado) {
                setCarregando(false);
                setErro("Não foi possível validar a biometria.");
                return;
            }

            await salvarUsuario(1, "Missão Guadalupe", "missaoguadalupe@gmail.com");
            setCarregando(false);
            navigation.replace("Home");
            return;
        } catch (erroBiometria) {
            setCarregando(false);
            setErro("Não foi possível validar a biometria.");
            return;
        }
    }

    return (
        <SafeAreaView style={css.pagina}>
            <KeyboardAvoidingView style={css.conteudo} behavior="padding">
                <View style={css.marca}>
                    <Image source={require("../../../assets/logo.png")} style={css.logo} />
                    <View>
                        <Text style={css.nomeMarca}>Guadalupe</Text>
                        <Text style={css.nomeMarca}>Gestão</Text>
                    </View>
                </View>

                <View style={css.apresentacao}>
                    <Text style={css.titulo}>Olá, que bom ter você aqui!</Text>
                    <Text style={css.subtitulo}>Entre para acompanhar e registrar as movimentações da Missão.</Text>
                </View>

                <CampoTexto titulo="E-mail" placeholder="seuemail@exemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
                <CampoTexto titulo="Senha" placeholder="Digite sua senha" value={senha} onChangeText={setSenha} secureTextEntry={true} />

                {erro ? <Text style={css.erro}>{erro}</Text> : null}

                <Botao titulo="Entrar" onPress={entrar} carregando={carregando} />
                <Botao titulo="Entrar com biometria" onPress={entrarComBiometria} carregando={carregando} tipo="secundario" />
                <Text style={css.rodape}>© Missão Guadalupe</Text>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
