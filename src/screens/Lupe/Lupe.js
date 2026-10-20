import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AvisoErro from "../../components/AvisoErro";
import { mensagemErro } from "../../services/api";
import { conversarComLupe, decidirAcaoLupe, listarAcoesLupe, LIMITE_MENSAGEM_LUPE } from "../../services/lupe";
import AcoesLupe from "../../components/AcoesLupe";
import { getUsuario } from "../../services/usuarioStorage";
import { carregarConversaLupe, criarConversaLupe, excluirConversaLupe, listarConversasLupe, salvarConversaLupe } from "../../services/historicoLupe";
import HistoricoLupe from "./HistoricoLupe";
import css from "./LupeStyle";
import { montarMensagensLupe } from "../../services/mensagensLupe";

const sugestoes = ["Como cadastrar uma despesa?", "Como usar a foto do comprovante?", "Qual a diferença entre categoria e origem?"];

function formatarResposta(texto) {
    return texto.split(/(\*\*[\s\S]+?\*\*)/g).map((parte, indice) => (
        indice % 2 === 1 ? <Text key={indice} style={css.negrito}>{parte.slice(2, -2)}</Text> : parte
    ));
}

export default function Lupe({ navigation }) {
    const [conversa, setConversa] = useState(criarConversaLupe);
    const mensagens = conversa.mensagens;
    const mensagensVisiveis = montarMensagensLupe(conversa);
    const [usuarioId, setUsuarioId] = useState(null);
    const [conversas, setConversas] = useState([]);
    const [acoes, setAcoes] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(true);
    const [historicoAberto, setHistoricoAberto] = useState(false);
    const [operandoHistorico, setOperandoHistorico] = useState(false);
    const [erroHistorico, setErroHistorico] = useState("");
    const [naoSalva, setNaoSalva] = useState(false);
    const [conflitoHistorico, setConflitoHistorico] = useState(false);
    const [texto, setTexto] = useState("");
    const [pendente, setPendente] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState("");
    const [avisoAcao, setAvisoAcao] = useState("");
    const ocupado = useRef(false);
    const montado = useRef(true);
    const lista = useRef(null);
    const geracao = useRef(0);
    const estadoAtual = useRef(null);
    const precisaCarregar = useRef(true);
    const ultimoAvisoVisto = useRef(0);
    ultimoAvisoVisto.current = Math.max(ultimoAvisoVisto.current, conversa.revisaoAvisos || 0);
    estadoAtual.current = { conversa, naoSalva, carregandoHistorico, texto };

    useEffect(() => {
        if (!avisoAcao) return;
        const timer = setTimeout(() => setAvisoAcao(""), 12000);
        return () => clearTimeout(timer);
    }, [avisoAcao]);

    async function carregarHistorico() {
        geracao.current++;
        setCarregandoHistorico(true);
        setErroHistorico("");
        try {
            const usuario = await getUsuario();
            if (!usuario?.id) throw new Error("Entre novamente para acessar o histórico da Lupe.");
            if (montado.current) setUsuarioId(usuario.id);
            const historico = await listarConversasLupe(usuario.id);
            const recebimento = precisaCarregar.current && !estadoAtual.current.conversa.mensagens.length && historico[0]?.revisaoAvisos > 0 && historico[0];
            if (recebimento) {
                const salva = await carregarConversaLupe(usuario.id, recebimento.id);
                if (montado.current) setConversa(salva);
            }
            if (!montado.current) return;
            setUsuarioId(usuario.id);
            setConversas(historico);
            precisaCarregar.current = false;
        } catch (falha) {
            if (montado.current) setErroHistorico(mensagemErro(falha, "Não foi possível carregar seu histórico. Tente novamente."));
        } finally {
            if (montado.current) setCarregandoHistorico(false);
        }
    }

    useEffect(() => {
        montado.current = true;
        carregarHistorico();
        return () => { montado.current = false; };
    }, []);

    useEffect(() => {
        if (!usuarioId) return;
        let encerrado = false;
        let consultando = false;
        let timer;
        const ativo = () => !encerrado && AppState.currentState === "active" && navigation.isFocused();
        async function sincronizar() {
            clearTimeout(timer);
            if (!ativo() || consultando) return;
            consultando = true;
            const versao = geracao.current;
            const selecionada = estadoAtual.current.conversa;
            const podeAplicar = () => ativo() && montado.current && !ocupado.current && !estadoAtual.current.naoSalva && geracao.current === versao && estadoAtual.current.conversa.id === selecionada.id;
            try {
                if (ocupado.current || estadoAtual.current.naoSalva || estadoAtual.current.carregandoHistorico) return;
                const [historico, propostas] = await Promise.all([listarConversasLupe(usuarioId), listarAcoesLupe(selecionada.id, usuarioId)]);
                const novoRecebimento = !selecionada.mensagens.length && !selecionada.revisao && !estadoAtual.current.texto.trim() && historico[0]?.revisaoAvisos > ultimoAvisoVisto.current && historico[0];
                if (novoRecebimento) {
                    const recebida = await carregarConversaLupe(usuarioId, novoRecebimento.id);
                    if (podeAplicar() && !estadoAtual.current.texto.trim()) { setConversas(historico); setConversa(recebida); setAcoes([]); }
                    return;
                }
                const item = historico.find(item => item.id === selecionada.id);
                const salva = item && (item.revisao !== selecionada.revisao || (item.revisaoAvisos || 0) !== (selecionada.revisaoAvisos || 0))
                    ? await carregarConversaLupe(usuarioId, selecionada.id) : null;
                if (!podeAplicar()) return;
                setConversas(historico);
                setAcoes(propostas);
                if (salva) setConversa(salva);
                else if (!item && selecionada.revisao > 0) { setConversa(criarConversaLupe()); setAcoes([]); }
                if (precisaCarregar.current) { precisaCarregar.current = false; setErroHistorico(""); }
            } catch {
                // Uma falha de rede não apaga mensagens nem o texto que está sendo digitado.
            } finally {
                consultando = false;
                if (ativo()) timer = setTimeout(sincronizar, 4000);
            }
        }
        function retomar() {
            if (ativo()) sincronizar();
            else { geracao.current++; clearTimeout(timer); }
        }
        timer = setTimeout(sincronizar, 4000);
        const app = AppState.addEventListener("change", retomar);
        const foco = navigation.addListener("focus", retomar);
        const perdaFoco = navigation.addListener("blur", retomar);
        return () => {
            encerrado = true;
            clearTimeout(timer);
            app.remove();
            foco();
            perdaFoco();
        };
    }, [usuarioId, navigation]);

    async function guardarConversa(atualizada) {
        try {
            const resultado = await salvarConversaLupe(usuarioId, atualizada);
            if (montado.current) {
                setConversas(resultado.conversas);
                if (atualizada.id !== estadoAtual.current.conversa.id) setAcoes([]);
                setConversa(resultado.conversa);
                setNaoSalva(false);
                setConflitoHistorico(false);
                setErroHistorico("");
            }
        } catch (falha) {
            if (montado.current) {
                setNaoSalva(true);
                setConflitoHistorico(falha.status === 409);
                setErroHistorico(falha.status === 409 ? "A conversa mudou em outro dispositivo. Salve esta resposta como uma nova conversa para preservar as duas versões." : "Não foi possível sincronizar esta conversa. Mantenha a tela aberta e tente salvar novamente.");
            }
        }
    }

    async function tentarSalvar() {
        if (ocupado.current) return;
        ocupado.current = true;
        geracao.current++;
        setOperandoHistorico(true);
        try { await guardarConversa(conflitoHistorico ? { ...conversa, id: criarConversaLupe().id, revisao: 0 } : conversa); }
        finally {
            ocupado.current = false;
            if (montado.current) setOperandoHistorico(false);
        }
    }

    async function enviar(sugestao) {
        const mensagem = (sugestao ?? texto).trim();
        if (!mensagem || ocupado.current || naoSalva || !usuarioId || carregandoHistorico) return;
        ocupado.current = true;
        geracao.current++;
        setEnviando(true);
        setErro("");
        setAvisoAcao("");
        setPendente(mensagem);
        setTexto("");
        try {
            const resultado = await conversarComLupe(mensagem, mensagens, conversa.id);
            const atualizada = { ...conversa, atualizadaEm: new Date().toISOString(), mensagens: [...mensagens, { papel: "usuario", texto: mensagem }, { papel: "lupe", texto: resultado.resposta }] };
            if (montado.current) {
                setConversa(atualizada);
                setPendente("");
                setAcoes(resultado.acoes);
            }
            // Salva a resposta mesmo se o usuário tiver voltado durante a chamada.
            await guardarConversa(atualizada);
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
        if (ocupado.current || naoSalva) return;
        geracao.current++;
        setConversa(criarConversaLupe());
        setAvisoAcao("");
        setAcoes([]);
        setTexto("");
        setErro("");
        setErroHistorico("");
    }

    async function mostrarHistorico() {
        if (ocupado.current || naoSalva) return;
        ocupado.current = true;
        geracao.current++;
        setHistoricoAberto(true);
        setOperandoHistorico(true);
        setErroHistorico("");
        try {
            const historico = await listarConversasLupe(usuarioId);
            if (montado.current) setConversas(historico);
        } catch (falha) {
            if (montado.current) setErroHistorico(mensagemErro(falha, "Não foi possível carregar seu histórico. Feche e tente novamente."));
        } finally {
            ocupado.current = false;
            if (montado.current) setOperandoHistorico(false);
        }
    }

    async function abrirConversa(id) {
        if (ocupado.current || naoSalva) return;
        ocupado.current = true;
        geracao.current++;
        setOperandoHistorico(true);
        setErroHistorico("");
        try {
            const [salva, propostas] = await Promise.all([carregarConversaLupe(usuarioId, id), listarAcoesLupe(id, usuarioId)]);
            if (!montado.current) return;
            setConversa(salva);
            setAvisoAcao("");
            setAcoes(propostas);
            setTexto("");
            setErro("");
            setHistoricoAberto(false);
        } catch (falha) {
            if (montado.current) setErroHistorico(mensagemErro(falha, "Não foi possível abrir esta conversa. Tente novamente."));
        } finally {
            ocupado.current = false;
            if (montado.current) setOperandoHistorico(false);
        }
    }

    function confirmarExclusao(item) {
        if (ocupado.current || naoSalva) return;
        Alert.alert("Excluir conversa", "Esta conversa será removida do histórico da sua conta em todos os dispositivos.", [
            { text: "Cancelar", style: "cancel" },
            { text: "Excluir", style: "destructive", onPress: async () => {
                if (ocupado.current || !montado.current) return;
                ocupado.current = true;
                geracao.current++;
                setOperandoHistorico(true);
                setErroHistorico("");
                try {
                    const historico = await excluirConversaLupe(usuarioId, item.id);
                    if (!montado.current) return;
                    setConversas(historico);
                    if (conversa.id === item.id) {
                        setConversa(criarConversaLupe());
                        setAcoes([]);
                        setTexto("");
                        setErro("");
                    }
                } catch (falha) {
                    if (montado.current) setErroHistorico(mensagemErro(falha, "Não foi possível excluir esta conversa. Tente novamente."));
                } finally {
                    ocupado.current = false;
                    if (montado.current) setOperandoHistorico(false);
                }
            } },
        ]);
    }

    async function decidirAcao(acao, confirmar) {
        if (ocupado.current || naoSalva || acao.conversa_id !== conversa.id) return;
        ocupado.current = true;
        geracao.current++;
        setOperandoHistorico(true);
        setErro("");
        setAvisoAcao("");
        try {
            const resultado = await decidirAcaoLupe(acao.id, confirmar, usuarioId);
            if (montado.current) setAcoes(atuais => atuais.map(item => item.id === acao.id ? resultado.acao : item));
            if (!['concluida', 'cancelada'].includes(resultado.acao.estado)) {
                if (montado.current) setAvisoAcao(resultado.resposta);
            }
            const salva = resultado.conversa || await carregarConversaLupe(usuarioId, conversa.id);
            if (montado.current) setConversa(salva);
        } catch (falha) {
            if (montado.current) setAvisoAcao(mensagemErro(falha, "Não consegui confirmar o resultado. Confira o cadastro antes de tentar novamente."));
            try {
                const propostas = await listarAcoesLupe(conversa.id, usuarioId);
                if (montado.current) setAcoes(propostas);
            } catch { /* A confirmação não é repetida automaticamente. */ }
        } finally {
            ocupado.current = false;
            if (montado.current) setOperandoHistorico(false);
        }
    }

    const bloqueado = enviando || carregandoHistorico || operandoHistorico || !usuarioId;

    return <SafeAreaView style={css.pagina}>
        <View style={css.topo}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => navigation.goBack()} style={css.voltar}><Text style={css.seta}>←</Text></Pressable>
            <Image source={require("../../../assets/Lupe.png")} style={css.avatarPequeno} resizeMode="contain" accessibilityLabel="Lupe" />
            <View style={css.identidade}><Text style={css.titulo}>Lupe</Text></View>
        </View>
        <View style={css.acoesConversa}>
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir histórico de conversas" disabled={bloqueado || naoSalva} onPress={mostrarHistorico} style={[css.acaoConversa, (bloqueado || naoSalva) && css.desabilitado]}><Text style={css.link}>Histórico ({conversas.length})</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Iniciar nova conversa" disabled={bloqueado || naoSalva || (!mensagensVisiveis.length && !texto)} onPress={novaConversa} style={[css.acaoConversa, (bloqueado || naoSalva || (!mensagensVisiveis.length && !texto)) && css.desabilitado]}><Text style={css.link}>+ Nova conversa</Text></Pressable>
        </View>
        {carregandoHistorico && <ActivityIndicator color="#326bff" style={{ padding: 12 }} />}
        {!!erroHistorico && !historicoAberto && <View style={css.erroHistorico}><AvisoErro erro={erroHistorico} /><Pressable accessibilityRole="button" disabled={enviando || operandoHistorico || carregandoHistorico} onPress={naoSalva ? tentarSalvar : carregarHistorico} style={css.acaoConversa}><Text style={css.link}>{conflitoHistorico ? "Salvar como nova conversa" : naoSalva ? "Tentar salvar conversa" : "Tentar carregar histórico"}</Text></Pressable></View>}
        <KeyboardAvoidingView style={css.teclado} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView ref={lista} contentContainerStyle={css.conversa} keyboardShouldPersistTaps="handled" onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}>
                {!mensagensVisiveis.length && !pendente && <View style={css.boasVindas}>
                    <Image source={require("../../../assets/Lupe.png")} style={css.avatar} resizeMode="contain" accessibilityLabel="Lupe, sua assistente" />
                    <Text style={css.saudacao}>Oi, eu sou a Lupe!</Text>
                    <Text style={css.apresentacao}>Vamos conversar? Posso ajudar você a usar o Guadalupe Gestão e organizar seus lançamentos.</Text>
                    <Text style={css.rotuloSugestoes}>Por onde começamos?</Text>
                    {sugestoes.map(sugestao => <Pressable key={sugestao} accessibilityRole="button" disabled={bloqueado} onPress={() => enviar(sugestao)} style={css.sugestao}><Text style={css.textoSugestao}>{sugestao}</Text><Text style={css.link}>↗</Text></Pressable>)}
                </View>}
                {mensagensVisiveis.map(mensagem => <View key={mensagem.chave} style={[css.balao, mensagem.papel === "usuario" ? css.balaoUsuario : css.balaoLupe]}>
                    <Text selectable style={[css.mensagem, mensagem.papel === "usuario" && css.mensagemUsuario]}>{mensagem.papel === "lupe" ? formatarResposta(mensagem.texto) : mensagem.texto}</Text>
                </View>)}
                {!!pendente && <View style={[css.balao, css.balaoUsuario]}><Text style={[css.mensagem, css.mensagemUsuario]}>{pendente}</Text></View>}
                <AcoesLupe acoes={acoes} ocupado={bloqueado || naoSalva} onDecidir={decidirAcao} />
                {enviando && <View accessibilityLiveRegion="polite" style={css.digitando}><ActivityIndicator size="small" color="#326bff" /><Text style={css.textoDigitando}>Lupe está respondendo...</Text></View>}
            </ScrollView>
            <View style={css.compositor}>
                {!!avisoAcao && <View style={css.avisoAcao} accessibilityRole="alert"><Text style={css.textoAvisoAcao}>{avisoAcao}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={() => setAvisoAcao("")} style={css.fecharAviso}><Text style={css.textoAvisoAcao}>×</Text></Pressable></View>}
                {!!erro && <View accessibilityLiveRegion="polite"><AvisoErro erro={erro} /><Text style={css.ajudaErro}>Sua mensagem foi mantida abaixo. Toque em Enviar para tentar novamente.</Text></View>}
                <View style={css.linhaEntrada}>
                    <TextInput accessibilityLabel="Mensagem para a Lupe" style={css.entrada} placeholder="Converse com a Lupe..." placeholderTextColor="#8592a8" multiline maxLength={LIMITE_MENSAGEM_LUPE} value={texto} onChangeText={setTexto} editable={!bloqueado} />
                    <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" accessibilityState={{ disabled: bloqueado || !texto.trim(), busy: enviando }} disabled={bloqueado || !texto.trim()} onPress={() => enviar()} style={[css.enviar, (bloqueado || !texto.trim()) && css.desabilitado]}>{enviando ? <ActivityIndicator color="#fff" /> : <Text style={css.textoEnviar}>Enviar ↑</Text>}</Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
        <HistoricoLupe aberto={historicoAberto} conversas={conversas} atual={conversa.id} ocupado={operandoHistorico} erro={erroHistorico} onFechar={() => setHistoricoAberto(false)} onAbrir={abrirConversa} onExcluir={confirmarExclusao} />
    </SafeAreaView>;
}
