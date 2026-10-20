import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AvisoErro from "../../components/AvisoErro";
import { mensagemErro } from "../../services/api";
import { conversarComLupe, LIMITE_MENSAGEM_LUPE } from "../../services/lupe";
import css from "./LupeStyle";

const sugestoes = ["Como cadastrar uma despesa?", "Como usar a foto do comprovante?", "Qual a diferença entre categoria e origem?"];

export default function Lupe({ navigation }) {
    const [mensagens, setMensagens] = useState([]);
    const [texto, setTexto] = useState("");
    const [pendente, setPendente] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState("");
    const ocupado = useRef(false);
    const montado = useRef(true);
    const lista = useRef(null);

    useEffect(() => {
        montado.current = true;
        return () => { montado.current = false; };
    }, []);

    async function enviar(sugestao) {
        const mensagem = (sugestao ?? texto).trim();
        if (!mensagem || ocupado.current) return;
        ocupado.current = true;
        setEnviando(true);
        setErro("");
        setPendente(mensagem);
        setTexto("");
        try {
            const resposta = await conversarComLupe(mensagem, mensagens);
            if (!montado.current) return;
            setMensagens(atuais => [...atuais, { papel: "usuario", texto: mensagem }, { papel: "lupe", texto: resposta }]);
        } catch (falha) {
            if (!montado.current) return;
            setTexto(mensagem);
            setErro(mensagemErro(falha, "Não foi possível conversar com a Lupe. Tente novamente."));
        } finally {
            ocupado.current = false;
            if (montado.current) {
                setPendente("");
                setEnviando(false);
            }
        }
    }

    function novaConversa() {
        if (ocupado.current) return;
        Alert.alert("Nova conversa", "Deseja limpar esta conversa com a Lupe?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Limpar", onPress: () => { setMensagens([]); setTexto(""); setErro(""); } },
        ]);
    }

    return <SafeAreaView style={css.pagina}>
        <View style={css.topo}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => navigation.goBack()} style={css.voltar}><Text style={css.seta}>←</Text></Pressable>
            <View style={css.avatarPequeno}><Text style={css.letraPequena}>L</Text></View>
            <View style={css.identidade}><Text style={css.titulo}>Lupe</Text><Text style={css.subtitulo}>Sua assistente de IA</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Iniciar nova conversa" disabled={enviando || !mensagens.length} onPress={novaConversa} style={[css.novaConversa, (enviando || !mensagens.length) && css.desabilitado]}><Text style={css.link}>Nova conversa</Text></Pressable>
        </View>
        <KeyboardAvoidingView style={css.teclado} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView ref={lista} contentContainerStyle={css.conversa} keyboardShouldPersistTaps="handled" onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}>
                {!mensagens.length && !pendente && <View style={css.boasVindas}>
                    <View style={css.avatar}><Text style={css.letra}>L</Text><View style={css.brilho}><Text style={css.estrela}>✦</Text></View></View>
                    <Text style={css.saudacao}>Oi, eu sou a Lupe!</Text>
                    <Text style={css.apresentacao}>Vamos conversar? Posso ajudar você a usar o Guadalupe Gestão e organizar seus lançamentos.</Text>
                    <Text style={css.rotuloSugestoes}>Por onde começamos?</Text>
                    {sugestoes.map(sugestao => <Pressable key={sugestao} accessibilityRole="button" disabled={enviando} onPress={() => enviar(sugestao)} style={css.sugestao}><Text style={css.textoSugestao}>{sugestao}</Text><Text style={css.link}>↗</Text></Pressable>)}
                </View>}
                {mensagens.map((mensagem, indice) => <View key={indice} style={[css.balao, mensagem.papel === "usuario" ? css.balaoUsuario : css.balaoLupe]}>
                    <Text style={[css.autor, mensagem.papel === "usuario" && css.autorUsuario]}>{mensagem.papel === "usuario" ? "Você" : "Lupe"}</Text>
                    <Text selectable style={[css.mensagem, mensagem.papel === "usuario" && css.mensagemUsuario]}>{mensagem.texto}</Text>
                </View>)}
                {!!pendente && <View style={[css.balao, css.balaoUsuario]}><Text style={[css.autor, css.autorUsuario]}>Você</Text><Text style={[css.mensagem, css.mensagemUsuario]}>{pendente}</Text></View>}
                {enviando && <View accessibilityLiveRegion="polite" style={css.digitando}><ActivityIndicator size="small" color="#326bff" /><Text style={css.textoDigitando}>Lupe está respondendo...</Text></View>}
            </ScrollView>
            <View style={css.compositor}>
                {!!erro && <View accessibilityLiveRegion="polite"><AvisoErro erro={erro} /><Text style={css.ajudaErro}>Sua mensagem foi mantida abaixo. Toque em Enviar para tentar novamente.</Text></View>}
                <View style={css.linhaEntrada}>
                    <TextInput accessibilityLabel="Mensagem para a Lupe" style={css.entrada} placeholder="Converse com a Lupe..." placeholderTextColor="#8592a8" multiline maxLength={LIMITE_MENSAGEM_LUPE} value={texto} onChangeText={setTexto} editable={!enviando} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" accessibilityState={{ disabled: enviando || !texto.trim(), busy: enviando }} disabled={enviando || !texto.trim()} onPress={() => enviar()} style={[css.enviar, (enviando || !texto.trim()) && css.desabilitado]}>{enviando ? <ActivityIndicator color="#fff" /> : <Text style={css.textoEnviar}>Enviar ↑</Text>}</Pressable>
                </View>
                <Text style={css.rodape}>A Lupe pode cometer erros. Confira as orientações. · {texto.length}/{LIMITE_MENSAGEM_LUPE}</Text>
            </View>
        </KeyboardAvoidingView>
    </SafeAreaView>;
}
