import AvisoErro from "../../components/AvisoErro";
import { mensagemErro } from "../../services/api";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CampoTexto from "../../components/CampoTexto";
import Seletor from "../../components/Seletor";
import Botao from "../../components/Botao";
import MenuInferior from "../../components/MenuInferior";
import { carregarConta, salvarConta, PERFIS, STATUS } from "../../services/conta";
import { limparDados } from "../../services/usuarioStorage";
import { version } from "../../../package.json";
import css from "./MaisStyle";

export default function Mais({ navigation }) {
    const [conta, setConta] = useState(null);
    const [dados, setDados] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const ocupado = useRef(false);
    const consulta = useRef(0);

    async function carregar() {
        const atual = ++consulta.current;
        setCarregando(true);
        setErro("");
        try {
            const usuario = await carregarConta();
            if (atual !== consulta.current) return;
            setConta(usuario);
            setDados(usuario);
        } catch (falha) {
            if (atual === consulta.current) setErro(mensagemErro(falha));
        } finally {
            if (atual === consulta.current) setCarregando(false);
        }
    }

    useEffect(() => {
        carregar();
        return () => { consulta.current += 1; };
    }, []);

    async function encerrar() {
        await limparDados();
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    }

    async function sair() {
        if (ocupado.current) return;
        ocupado.current = true;
        setSalvando(true);
        try { await encerrar(); }
        catch { setErro("Não foi possível encerrar a sessão. Tente novamente."); }
        finally { ocupado.current = false; setSalvando(false); }
    }

    async function salvar() {
        if (ocupado.current || !dados) return;
        ocupado.current = true;
        setSalvando(true);
        setErro("");
        try {
            const resultado = await salvarConta(dados);
            setConta(resultado.conta);
            setDados(resultado.conta);
            if (resultado.conta.tipo !== 0 || resultado.conta.status !== 0 || resultado.aviso) {
                await encerrar();
                Alert.alert("Conta atualizada", resultado.aviso || "As alterações foram salvas e a sessão foi encerrada. O aplicativo permite acesso a administradores ativos.");
            } else {
                Alert.alert("Conta atualizada", "Alterações salvas com sucesso.");
            }
        } catch (falha) {
            setErro(mensagemErro(falha));
        } finally {
            ocupado.current = false;
            setSalvando(false);
        }
    }

    function alterar(campo, valor) { setDados(atual => ({ ...atual, [campo]: valor })); }
    const iniciais = conta?.nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join("").toUpperCase();

    return <SafeAreaView style={css.pagina}>
        <View style={css.topo}><View><Text style={css.titulo}>Mais</Text><Text style={css.subtitulo}>Configurações da conta</Text></View><Image source={require("../../../assets/logo.png")} style={css.logo} resizeMode="contain" /></View>
        <KeyboardAvoidingView style={css.teclado} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={css.conteudo} keyboardShouldPersistTaps="handled">
                {conta && <View style={css.perfil}><View style={css.avatar}><Text style={css.iniciais}>{iniciais}</Text></View><View style={css.identidade}><Text style={css.nome}>{conta.nome}</Text><Text style={css.cargo}>{PERFIS.find(item => item.valor === conta.tipo)?.nome}</Text></View></View>}
                <View style={css.cartao}>
                    <Text style={css.secao}>Dados da conta</Text><Text style={css.descricao}>Gerencie os dados da sua conta.</Text>
                    {carregando ? <ActivityIndicator color="#326bff" /> : dados && <View pointerEvents={salvando ? "none" : "auto"}>
                        <CampoTexto titulo="Nome" value={dados.nome} onChangeText={valor => alterar("nome", valor)} />
                        <CampoTexto titulo="E-mail" value={dados.email} keyboardType="email-address" onChangeText={valor => alterar("email", valor)} />
                        <Seletor titulo="Perfil de acesso" valor={dados.tipo} opcoes={PERFIS} onChange={valor => alterar("tipo", valor)} desabilitado={salvando} />
                        <Seletor titulo="Status" valor={dados.status} opcoes={STATUS} onChange={valor => alterar("status", valor)} desabilitado={salvando} />
                        {(dados.tipo !== 0 || dados.status !== 0) && <Text style={css.aviso}>Ao salvar, sua sessão será encerrada. O app permite acesso a administradores ativos.</Text>}
                        <Botao titulo="Salvar alterações" onPress={salvar} carregando={salvando} />
                    </View>}
                    {!!erro && <AvisoErro erro={erro} />}
                    {!carregando && !dados && <Botao titulo="Tentar novamente" onPress={carregar} tipo="secundario" />}
                </View>
                <Pressable accessibilityRole="button" disabled={salvando} onPress={sair} style={css.sair}><Text style={css.textoSair}>Sair do aplicativo</Text></Pressable>
                <Text style={css.rodape}>Guadalupe Gestões · versão mobile {version}</Text>
            </ScrollView>
        </KeyboardAvoidingView>
        <View pointerEvents={salvando ? "none" : "auto"}><MenuInferior navigation={navigation} ativo="Mais" /></View>
    </SafeAreaView>;
}
