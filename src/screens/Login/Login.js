import AvisoErro from "../../components/AvisoErro";
import { Image, KeyboardAvoidingView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import Botao from "../../components/Botao";
import CampoTexto from "../../components/CampoTexto";
import { realizarLogin, realizarLoginComBiometria } from "../../services/login";
import { mensagemErro } from "../../services/api";
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
            setErro(mensagemErro(erroLogin, "Não foi possível entrar. Confira e-mail e senha e tente novamente."));
            return;
        }
    }

    async function entrarComBiometria() {
        setErro("");
        setCarregando(true);

        try {
            await realizarLoginComBiometria();
            setCarregando(false);
            navigation.replace("Home");
            return;
        } catch (erroBiometria) {
            setCarregando(false);
            setErro(mensagemErro(erroBiometria, "Não foi possível entrar com biometria. Tente novamente ou entre com e-mail e senha."));
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

                {erro ? <AvisoErro erro={erro} /> : null}

                <Botao titulo="Entrar" onPress={entrar} carregando={carregando} />
                <Botao titulo="Entrar com biometria" onPress={entrarComBiometria} carregando={carregando} tipo="secundario" />
                <Text style={css.rodape}>© Missão Guadalupe</Text>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
