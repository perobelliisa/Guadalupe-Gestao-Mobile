import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listarNotificacoes } from "../services/notificacoes";
import { pagarVencimento } from "../services/movimentacoes";
import ConfirmarPagamento from "./ConfirmarPagamento";
import { mensagemErro } from "../services/api";

export default function Notificacoes({ navigation, onPagamento }) {
    const [aberto, setAberto] = useState(false);
    const [notificacoes, setNotificacoes] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const consulta = useRef(0);
    const pagamentoEmCurso = useRef(false);
    const envioPagamento = useRef(false);
    const [pagando, setPagando] = useState(false);

    const [pagamento, setPagamento] = useState(null);
    const [erroPagamento, setErroPagamento] = useState("");

    function abrirPagamento(item) {
        if (pagamentoEmCurso.current) return;
        // Suspende as consultas enquanto este vencimento aguarda confirmação.
        pagamentoEmCurso.current = true;
        consulta.current++;
        setCarregando(false);
        setErroPagamento("");
        setPagamento(item);
    }

    function cancelarPagamento() {
        if (pagando) return;
        pagamentoEmCurso.current = false;
        setPagamento(null);
    }

    function fechar() {
        if (pagando) return;
        if (pagamento) cancelarPagamento();
        else setAberto(false);
    }

    async function confirmarPagamento() {
        if (envioPagamento.current || !pagamento) return;
        envioPagamento.current = true;
        setPagando(true);
        setErroPagamento("");
        try {
            await pagarVencimento(pagamento.id, pagamento.vencimento);
            setNotificacoes(atuais => atuais.filter(aviso => aviso.chave !== pagamento.chave));
            setPagamento(null);
            pagamentoEmCurso.current = false;
            onPagamento?.();
            await atualizar(true);
        } catch (falha) {
            setErroPagamento(mensagemErro(falha));
        } finally {
            envioPagamento.current = false;
            setPagando(false);
        }
    }

    async function atualizar(aposPagamento = false) {
        if (pagamentoEmCurso.current && aposPagamento !== true) return;
        const numero = ++consulta.current;
        setCarregando(true);
        setErro("");
        try {
            const dados = await listarNotificacoes();
            if (numero === consulta.current) setNotificacoes(dados);
        } catch (falha) {
            if (numero === consulta.current) setErro(mensagemErro(falha));
        } finally {
            if (numero === consulta.current) setCarregando(false);
        }
    }

    useEffect(() => {
        atualizar();
        const removerFoco = navigation.addListener("focus", atualizar);
        const estado = AppState.addEventListener("change", valor => {
            if (valor === "active") atualizar();
        });
        const timer = setInterval(() => {
            if (AppState.currentState === "active") atualizar();
        }, 60000);
        return () => {
            consulta.current++;
            removerFoco();
            estado.remove();
            clearInterval(timer);
        };
    }, [navigation]);

    return (
        <>
            <Pressable accessibilityRole="button" accessibilityLabel={`Notificações, ${notificacoes.length} despesas pendentes`} onPress={() => { setAberto(true); atualizar(); }} style={css.botao}>
                <View style={css.sino}><View style={css.alca} /><View style={css.base} /><View style={css.badalo} /></View>
                {notificacoes.length > 0 && <View style={css.contador}><Text style={css.numero}>{notificacoes.length > 99 ? "99+" : notificacoes.length}</Text></View>}
                {erro ? <View style={css.pontoErro} /> : null}
            </Pressable>
            <Modal visible={aberto} transparent animationType="fade" onRequestClose={fechar}>
                <View style={css.fundo}>
                    <Pressable style={StyleSheet.absoluteFillObject} accessibilityRole="button" accessibilityLabel="Fechar notificações" onPress={fechar} />
                    <SafeAreaView style={css.painel} edges={["bottom"]} accessibilityViewIsModal accessibilityElementsHidden={Boolean(pagamento)} importantForAccessibility={pagamento ? "no-hide-descendants" : "auto"}>
                        <View style={css.topo}>
                            <Text style={css.titulo}>Notificações</Text>
                            <Pressable accessibilityRole="button" onPress={fechar} style={css.fechar}><Text style={css.link}>Fechar</Text></Pressable>
                        </View>
                        <Text style={css.subtitulo}>Despesas vencidas ou que vencem nos próximos 13 dias</Text>
                        {carregando && <ActivityIndicator accessibilityLabel="Carregando notificações" color="#2f6bff" style={css.carregando} />}
                        {erro ? <View style={css.aviso}><Text accessibilityRole="alert" style={css.erro}>{erro}</Text>{notificacoes.length > 0 && <Text style={css.subtitulo}>Exibindo a última consulta.</Text>}</View> : null}
                        <ScrollView contentContainerStyle={css.lista}>
                            {notificacoes.map(item => (
                                <View key={item.chave} style={[css.cartao, item.vencida && css.cartaoVencido]}>
                                    <Text style={[css.tituloAviso, item.vencida && css.vermelho]}>{item.titulo}</Text>
                                    <Text style={css.mensagem}>{item.mensagem}</Text>
                                    <Pressable accessibilityRole="button" disabled={pagando || carregando} onPress={() => abrirPagamento(item)} style={css.pagar}><Text style={css.link}>{pagando ? "Salvando..." : "Marcar como pago"}</Text></Pressable>
                                </View>
                            ))}
                            {!carregando && !erro && notificacoes.length === 0 && <Text style={css.vazio}>Nenhuma despesa próxima do vencimento. Tudo em dia!</Text>}
                        </ScrollView>
                        <Pressable accessibilityRole="button" disabled={carregando || pagando} onPress={() => atualizar()} style={css.atualizar}><Text style={css.link}>{carregando ? "Atualizando..." : "Atualizar notificações"}</Text></Pressable>
                    </SafeAreaView>
                    <ConfirmarPagamento pagamento={pagamento} salvando={pagando} erro={erroPagamento} onCancelar={cancelarPagamento} onConfirmar={confirmarPagamento} />
                </View>
            </Modal>
        </>
    );
}

const css = StyleSheet.create({
    botao: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    sino: { width: 18, height: 20, borderWidth: 2, borderColor: "white", borderTopLeftRadius: 10, borderTopRightRadius: 10 },
    alca: { position: "absolute", top: -5, left: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: "white" },
    base: { position: "absolute", bottom: -2, left: -5, width: 24, height: 2, backgroundColor: "white", borderRadius: 2 },
    badalo: { position: "absolute", bottom: -7, left: 4, width: 6, height: 4, borderRadius: 3, backgroundColor: "white" },
    contador: { position: "absolute", right: 0, top: 0, minWidth: 18, paddingHorizontal: 4, height: 18, borderRadius: 9, backgroundColor: "#e74b54", alignItems: "center", justifyContent: "center" },
    numero: { color: "white", fontSize: 10, fontWeight: "700" },
    pontoErro: { position: "absolute", left: 5, top: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: "#ffcf70" },
    fundo: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 27, 48, 0.45)" },
    painel: { maxHeight: "80%", backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    titulo: { color: "#142849", fontSize: 20, fontWeight: "800" },
    fechar: { padding: 12 },
    link: { color: "#2f6bff", fontWeight: "700", fontSize: 13 },
    subtitulo: { color: "#77859c", fontSize: 12, lineHeight: 18, marginBottom: 12 },
    carregando: { marginVertical: 12 },
    lista: { paddingVertical: 8, gap: 10 },
    cartao: { borderRadius: 14, backgroundColor: "#fff8e9", padding: 16, borderLeftWidth: 3, borderLeftColor: "#eab044" },
    cartaoVencido: { backgroundColor: "#fff0ee", borderLeftColor: "#e74b54" },
    tituloAviso: { color: "#956110", fontSize: 14, fontWeight: "700", marginBottom: 6 },
    vermelho: { color: "#b53a36" },
    mensagem: { color: "#435069", fontSize: 13, lineHeight: 20 },
    vazio: { color: "#77859c", paddingVertical: 24, textAlign: "center", lineHeight: 22 },
    aviso: { padding: 12, borderRadius: 12, backgroundColor: "#fff0ee" },
    erro: { color: "#b53a36", lineHeight: 20 },
    pagar: { alignSelf: "flex-start", paddingVertical: 12 },
    atualizar: { padding: 16, alignItems: "center" },
});
