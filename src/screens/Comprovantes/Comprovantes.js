import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import MenuInferior from "../../components/MenuInferior";
import { listarMovimentacoes, listarProjetos } from "../../services/movimentacoes";
import { enviarComprovante, temComprovante, urlComprovante } from "../../services/comprovantes";
import css from "./ComprovantesStyle";

export default function Comprovantes({ navigation }) {
    const [movimentos, setMovimentos] = useState([]);
    const [projetos, setProjetos] = useState([]);
    const [busca, setBusca] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [consultado, setConsultado] = useState(false);
    const [erro, setErro] = useState("");
    const [enviando, setEnviando] = useState(null);
    const ocupado = useRef(false);
    const consulta = useRef(0);

    async function carregar() {
        const atual = ++consulta.current;
        setCarregando(true);
        setErro("");
        try {
            const [lista, contas] = await Promise.all([listarMovimentacoes(), listarProjetos()]);
            if (atual !== consulta.current) return;
            setMovimentos(lista);
            setProjetos(contas);
            setConsultado(true);
        } catch (falha) {
            if (atual === consulta.current) setErro(falha.message);
        } finally {
            if (atual === consulta.current) setCarregando(false);
        }
    }

    useEffect(() => {
        if (navigation.isFocused()) carregar();
        const remover = navigation.addListener("focus", carregar);
        return () => { remover(); consulta.current += 1; };
    }, [navigation]);

    async function anexar(item) {
        if (ocupado.current) return;
        ocupado.current = true;
        setEnviando(item.id_livro_caixa);
        try {
            const resultado = await DocumentPicker.getDocumentAsync({
                type: ["application/pdf", "image/jpeg", "image/png"],
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (resultado.canceled) return;
            const anexo = await enviarComprovante(item.id_livro_caixa, resultado.assets[0]);
            // Evita que uma consulta anterior ao envio apague o anexo confirmado.
            consulta.current += 1;
            setCarregando(false);
            setMovimentos(registros => registros.map(registro =>
                registro.id_livro_caixa === item.id_livro_caixa ? { ...registro, anexo } : registro));
        } catch (falha) {
            Alert.alert("Não foi possível anexar", falha.message);
        } finally {
            ocupado.current = false;
            setEnviando(null);
        }
    }

    async function abrir(item) {
        try { await Linking.openURL(urlComprovante(item.anexo)); }
        catch { Alert.alert("Não foi possível abrir", "Confira a conexão e se há um aplicativo para abrir este comprovante."); }
    }

    function detalhe(item) {
        const projeto = Number(item.conta) ? projetos.find(conta => Number(conta.id_projeto) === Number(item.conta))?.nome || `Projeto ${item.conta}` : "Missão Guadalupe";
        const data = item.data ? new Date(String(item.data).slice(0, 10) + "T12:00:00") : null;
        return `${projeto} · ${data && !Number.isNaN(data.getTime()) ? data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) : "Sem data"}`;
    }

    function normalizar(texto) {
        return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    }

    const termo = normalizar(busca.trim());
    const comprovados = movimentos.filter(temComprovante).length;
    const lista = movimentos.filter(item => normalizar(`${item.descricao || ""} ${Number(item.tipo) === 0 ? "Entrada Receita" : "Despesa"}`).includes(termo))
        .sort((a, b) => String(b.data).localeCompare(String(a.data)) || Number(b.id_livro_caixa) - Number(a.id_livro_caixa));

    return (
        <SafeAreaView style={css.pagina}>
            <View style={css.topo}>
                <View><Text style={css.titulo}>Comprovantes</Text><Text style={css.subtitulo}>Organize notas, recibos e anexos</Text></View>
                <Image source={require("../../../assets/logo.png")} style={css.logo} resizeMode="contain" />
            </View>
            <View style={css.busca}>
                <Text style={css.lupa}>⌕</Text>
                <TextInput accessibilityLabel="Pesquisar entrada ou despesa" placeholder="Pesquisar entrada ou despesa" placeholderTextColor="#8c9bb5" style={css.inputBusca} value={busca} onChangeText={setBusca} returnKeyType="search" />
                {!!busca && <Pressable accessibilityRole="button" accessibilityLabel="Limpar pesquisa" onPress={() => setBusca("")} style={css.limpar}><Text style={css.textoBotao}>×</Text></Pressable>}
            </View>
            <FlatList data={lista} keyExtractor={item => String(item.id_livro_caixa)} contentContainerStyle={css.lista}
                keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
                refreshing={carregando} onRefresh={carregar}
                ListHeaderComponent={<>
                    <View style={css.resumo}>
                        <View style={[css.contador, css.enviado]}><View style={[css.icone, css.iconeEnviado]}><Text style={[css.simbolo, css.verde]}>✓</Text></View><Text style={css.numero}>{consultado ? comprovados : "—"}</Text><Text style={css.legenda}>Comprovantes enviados</Text></View>
                    </View>
                    {!!erro && <View style={css.aviso}><Text style={css.erro}>{erro}</Text>{consultado && <Text style={css.textoAviso}>Exibindo a última consulta.</Text>}<Pressable accessibilityRole="button" onPress={carregar}><Text style={css.textoBotao}>Tentar novamente</Text></Pressable></View>}
                </>}
                ListEmptyComponent={!erro && <View style={css.aviso}>{carregando ? <ActivityIndicator color="#326bff" /> : <Text style={css.textoAviso}>{termo ? "Nenhuma transação encontrada para esta pesquisa." : "Nenhuma transação cadastrada."}</Text>}</View>}
                renderItem={({ item }) => <View style={css.cartao}>
                    <View style={css.linha}>
                        <View style={[css.icone, temComprovante(item) && css.iconeEnviado]}><Text style={[css.simbolo, temComprovante(item) && css.verde]}>{temComprovante(item) ? "✓" : "▤"}</Text></View>
                        <View style={css.descricao}><Text style={css.nome}>{item.descricao}</Text><Text style={css.detalhe}>{Number(item.tipo) === 0 ? "Entrada" : "Despesa"} · {detalhe(item)}</Text></View>
                        <Text style={css.valor}>{Number(item.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
                    </View>
                    {temComprovante(item) ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir comprovante de ${item.descricao}`} style={css.arquivo} onPress={() => abrir(item)}><Text style={css.textoBotao}>↗</Text><Text style={css.nomeArquivo} numberOfLines={1}>{item.anexo.split("/").pop()}</Text><Text style={css.status}>Enviado</Text></Pressable>
                        : <Pressable accessibilityRole="button" accessibilityLabel={`Anexar comprovante de ${item.descricao}`} accessibilityState={{ disabled: enviando !== null, busy: enviando === item.id_livro_caixa }} disabled={enviando !== null} onPress={() => anexar(item)} style={[css.botaoAnexar, enviando !== null && css.desabilitado]}>
                            {enviando === item.id_livro_caixa && <ActivityIndicator size="small" color="#326bff" />}
                            <Text style={css.textoBotao}>{enviando === item.id_livro_caixa ? "Anexando..." : "Anexar comprovante"}</Text>
                        </Pressable>}
                </View>}
            />
            <MenuInferior navigation={navigation} ativo="Comprovantes" />
        </SafeAreaView>
    );
}
