import AvisoErro from "../../components/AvisoErro";
import { mensagemErro } from "../../services/api";
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import MenuInferior from "../../components/MenuInferior";
import { listarMovimentacoes, listarProjetos } from "../../services/movimentacoes";
import EditorMovimentacao from "../../components/EditorMovimentacao";
import css from "./MovimentacoesStyle";

export default function Movimentacoes({ navigation }) {
    const [movimentacoes, setMovimentacoes] = useState([]);
    const [projetos, setProjetos] = useState([]);
    const [busca, setBusca] = useState("");
    const [filtro, setFiltro] = useState("Todos");
    const [recentes, setRecentes] = useState(true);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    const [selecionada, setSelecionada] = useState(null);
    const consulta = useRef(0);

    async function carregar() {
        const numero = ++consulta.current;
        setCarregando(true);
        setErro("");
        try {
            const [lista, listaProjetos] = await Promise.all([listarMovimentacoes(), listarProjetos()]);
            if (numero === consulta.current) { setMovimentacoes(lista); setProjetos(listaProjetos); }
        } catch (erroApi) {
            if (numero === consulta.current) setErro(mensagemErro(erroApi));
        } finally {
            if (numero === consulta.current) setCarregando(false);
        }
    }

    useEffect(() => {
        if (navigation.isFocused()) carregar();
        const remover = navigation.addListener("focus", carregar);
        return () => { remover(); consulta.current++; };
    }, [navigation]);

    function nomeProjeto(conta) {
        if (!Number(conta)) return "Missão Guadalupe";
        const projeto = projetos.find(item => Number(item.id_projeto) === Number(conta));
        return projeto ? projeto.nome : "Projeto " + conta;
    }

    const lista = movimentacoes.filter(item => {
        const tipo = Number(item.tipo);
        const tipoCorreto = filtro === "Todos" || (filtro === "Receitas" && tipo === 0) || (filtro === "Despesas" && tipo === 1);
        const texto = `${item.descricao} ${item.categoria || ""} ${nomeProjeto(item.conta)}`.toLocaleLowerCase("pt-BR");
        return tipoCorreto && texto.includes(busca.trim().toLocaleLowerCase("pt-BR"));
    }).sort((a, b) => {
        const ordem = String(b.data).localeCompare(String(a.data)) || Number(b.id_livro_caixa) - Number(a.id_livro_caixa);
        return recentes ? ordem : -ordem;
    });

    function mostrarData(data) {
        if (!data) return "Sem data";
        const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
        return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }

    function renderizar({ item, index }) {
        const receita = Number(item.tipo) === 0;
        return (
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.descricao}`} onPress={() => setSelecionada(item)} style={[css.cartao, index === 0 && css.primeiraLinha, index === lista.length - 1 && css.ultimaLinha]}>
                <View style={css.linha}>
                    <View style={[css.icone, receita ? css.fundoReceita : css.fundoDespesa]}>
                        <Text style={[css.seta, receita ? css.receita : css.despesa]}>{receita ? "↙" : "↗"}</Text>
                    </View>
                    <View style={css.descricao}>
                        <Text style={css.nome} numberOfLines={2}>{item.descricao}</Text>
                        <Text style={css.detalhe} numberOfLines={1}>{item.categoria || "Sem categoria"} · {nomeProjeto(item.conta)}</Text>
                    </View>
                    <View style={css.valores}>
                        <Text style={[css.valor, receita && css.receita]}>{receita ? "+ " : "− "}{Number(item.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
                        <Text style={css.detalhe}>{mostrarData(item.data)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    }

    return (
        <SafeAreaView style={css.pagina}>
            <View style={css.topo}>
                <View><Text style={css.titulo}>Movimentações</Text><Text style={css.subtitulo}>{carregando ? "Atualizando lançamentos..." : erro ? "Não foi possível atualizar" : `${lista.length} lançamento${lista.length === 1 ? " encontrado" : "s encontrados"}`}</Text></View>
                <Image source={require("../../../assets/logo.png")} style={css.logo} resizeMode="contain" />
            </View>
            <View style={css.controles}>
                <View style={css.busca}><Text style={css.lupa}>⌕</Text><TextInput accessibilityLabel="Buscar lançamento" style={css.inputBusca} placeholder="Buscar lançamento" placeholderTextColor="#8c9bb5" value={busca} onChangeText={setBusca} /></View>
                <View style={css.filtros}>
                    {["Todos", "Receitas", "Despesas"].map(tipo => (
                        <Pressable key={tipo} accessibilityRole="button" accessibilityState={{ selected: filtro === tipo }} onPress={() => setFiltro(tipo)} style={[css.filtro, filtro === tipo && css.filtroAtivo]}>
                            <Text style={[css.textoFiltro, filtro === tipo && css.textoAtivo]}>{tipo}</Text>
                        </Pressable>
                    ))}
                    <Pressable accessibilityRole="button" accessibilityLabel={recentes ? "Mostrar mais antigos primeiro" : "Mostrar mais recentes primeiro"} onPress={() => setRecentes(!recentes)} style={[css.filtro, css.ordenar]}><Text style={css.textoFiltro}>{recentes ? "↓" : "↑"}</Text></Pressable>
                </View>
            </View>
            {filtro === "Despesas" && <Pressable accessibilityRole="button" onPress={() => navigation.navigate("NovaMovimentacao", { tipo: 1, tirarFoto: true })} style={{ marginHorizontal: 16, marginTop: 12, padding: 14, minHeight: 44, borderRadius: 12, backgroundColor: "#326bff", alignItems: "center" }}><Text style={{ color: "white", fontWeight: "700" }}>Cadastrar despesa pela foto</Text></Pressable>}
            <FlatList
                data={lista}
                keyExtractor={item => String(item.id_livro_caixa)}
                renderItem={renderizar}
                contentContainerStyle={css.lista}
                refreshing={carregando}
                onRefresh={carregar}
                ListHeaderComponent={erro ? <View style={css.aviso}><AvisoErro erro={erro} /><Pressable onPress={carregar}><Text style={css.link}>Tentar novamente</Text></Pressable></View> : null}
                ListEmptyComponent={!erro && <View style={css.aviso}>{carregando ? <ActivityIndicator color="#326bff" /> : <Text style={css.textoAviso}>{busca || filtro !== "Todos" ? "Nenhum lançamento encontrado para este filtro." : "Nenhuma movimentação cadastrada. Toque em + para começar."}</Text>}</View>}
            />
            <MenuInferior navigation={navigation} ativo="Movimentacoes" />
            {selecionada && <EditorMovimentacao item={selecionada} onFechar={() => setSelecionada(null)} onSalvar={() => { setSelecionada(null); carregar(); }} />}
        </SafeAreaView>
    );
}
