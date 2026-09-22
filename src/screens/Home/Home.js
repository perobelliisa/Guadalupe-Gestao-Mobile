import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getUsuario, limparDados } from "../../services/usuarioStorage";
import css from "./HomeStyle";
import MenuInferior from "../../components/MenuInferior";
import { carregarDashboard } from "../../services/dashboard";

export default function Home({ navigation }) {
    const [nome, setNome] = useState("");
    const [dadosFinanceiros, setDadosFinanceiros] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [mostrarValores, setMostrarValores] = useState(true);
    const requisicaoAtual = useRef(0);

    async function atualizar() {
        const numero = ++requisicaoAtual.current;
        setCarregando(true);
        setErro("");
        try {
            const dados = await carregarDashboard();
            if (numero === requisicaoAtual.current) setDadosFinanceiros(dados);
        } catch (erroApi) {
            if (numero === requisicaoAtual.current) setErro(erroApi.message);
        } finally {
            if (numero === requisicaoAtual.current) setCarregando(false);
        }
    }

    useEffect(() => {
        if (navigation.isFocused()) atualizar();
        const remover = navigation.addListener("focus", atualizar);
        return () => {
            remover();
            requisicaoAtual.current++;
        };
    }, [navigation]);

    useEffect(() => {
        async function carregarUsuario() {
            try {
                const usuario = await getUsuario();
                if (usuario) {
                    setNome(usuario.nome);
                }
            } catch {
                Alert.alert("Usuário", "Não foi possível carregar os dados do usuário.");
            }
        }
        carregarUsuario();
    }, []);

    const lancamentos = dadosFinanceiros?.lancamentos || [];
    const iniciais = nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(parte => parte[0]).join("").toUpperCase() || "G";
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? "Bom dia," : hora < 18 ? "Boa tarde," : "Boa noite,";

    function mostrarValor(valor) {
        if (!mostrarValores) return "••••••";
        if (valor === undefined || valor === null) return "R$ --";
        return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function mostrarData(data) {
        if (!data) return "Sem data";
        const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
        return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }

    async function sair() {
        try {
            await limparDados();
            navigation.replace("Login");
        } catch {
            Alert.alert("Sair", "Não foi possível encerrar a sessão. Tente novamente.");
        }
    }

    return (
        <SafeAreaView style={css.pagina}>
            <View style={css.topo}>
                <View style={css.usuario}>
                    <View style={css.avatar}><Text style={css.avatarTexto}>{iniciais}</Text></View>
                    <View style={css.identidade}><Text style={css.saudacao}>{saudacao}</Text><Text numberOfLines={1} style={css.nomeUsuario}>{nome || "Boas-vindas"}</Text></View>
                </View>
                <Pressable onPress={sair} style={css.botaoSair}><Text style={css.textoSair}>Sair</Text></Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={carregando} onRefresh={atualizar} tintColor="#ffffff" colors={["#2f6bff"]} />}>
                <View style={css.resumoAzul}>
                    <Text style={css.rotuloSaldo}>Saldo geral dos lançamentos</Text>
                    <View style={css.linhaSaldo}>
                        <Text style={css.saldo}>{mostrarValor(dadosFinanceiros?.saldo)}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={mostrarValores ? "Ocultar valores" : "Mostrar valores"} onPress={() => setMostrarValores(!mostrarValores)} style={css.botaoVisibilidade}>
                            <View style={css.olho}><View style={css.pupila} />{!mostrarValores && <View style={css.riscoOlho} />}</View>
                        </Pressable>
                    </View>
                    <View style={css.cartaoResumo}>
                        <View style={css.resumoItem}><View style={[css.iconeCirculo, css.fundoVerde]}><Text style={css.verde}>↙</Text></View><View style={css.resumoValores}><Text style={css.rotuloResumo}>Entradas</Text><Text style={css.valorResumo}>{mostrarValor(dadosFinanceiros?.receitas)}</Text></View></View>
                        <View style={css.divisor} />
                        <View style={css.resumoItem}><View style={[css.iconeCirculo, css.fundoVermelho]}><Text style={css.vermelho}>↗</Text></View><View style={css.resumoValores}><Text style={css.rotuloResumo}>Despesas</Text><Text style={css.valorResumo}>{mostrarValor(dadosFinanceiros?.despesas)}</Text></View></View>
                    </View>
                </View>

                <View style={css.conteudo}>
                    {erro ? <View style={css.avisoErro}><Text style={css.erro}>{erro}</Text>{dadosFinanceiros && <Text style={css.semLancamentosTexto}>Exibindo os dados da última consulta.</Text>}<Pressable onPress={atualizar}><Text style={css.verTodos}>Tentar novamente</Text></Pressable></View> : null}
                    <View style={css.linhaTitulo}><Text style={css.tituloSecao}>Acesso rápido</Text><Text style={css.periodo}>Todos os períodos</Text></View>
                    <View style={css.acessos}>
                        <Pressable onPress={() => navigation.navigate("NovaMovimentacao", { tipo: 0 })} style={css.acesso}><View style={[css.iconeAcesso, css.fundoVerde]}><Text style={css.verde}>↙</Text></View><Text style={css.textoAcesso}>Receita</Text></Pressable>
                        <Pressable onPress={() => navigation.navigate("NovaMovimentacao", { tipo: 1 })} style={css.acesso}><View style={[css.iconeAcesso, css.fundoVermelho]}><Text style={css.vermelho}>↗</Text></View><Text style={css.textoAcesso}>Despesa</Text></Pressable>
                        <Pressable onPress={() => navigation.navigate("Movimentacoes")} style={css.acesso}><View style={[css.iconeAcesso, css.fundoCinza]}><Text style={css.cinza}>▤</Text></View><Text style={css.textoAcesso}>Movimentos</Text></Pressable>
                    </View>
                    <View style={css.linhaTitulo}><Text style={css.tituloSecao}>Últimos lançamentos</Text><Pressable onPress={() => navigation.navigate("Movimentacoes")}><Text style={css.verTodos}>Ver todos</Text></Pressable></View>
                    {carregando && !dadosFinanceiros && <View style={css.semLancamentos}><ActivityIndicator color="#2f6bff" /><Text style={css.semLancamentosTexto}>Carregando movimentações...</Text></View>}
                    <View style={css.listaLancamentos}>
                        {lancamentos.map((item, indice) => {
                            const receita = Number(item.tipo) === 0;
                            return (
                                <Pressable key={item.id_livro_caixa} onPress={() => navigation.navigate("Movimentacoes")} style={[css.lancamento, indice < lancamentos.length - 1 && css.divisoriaLancamento]}>
                                    <View style={[css.iconeLancamento, receita ? css.fundoVerde : css.fundoVermelho]}><Text style={receita ? css.verde : css.vermelho}>{receita ? "↙" : "↗"}</Text></View>
                                    <View style={css.descricaoLancamento}><Text numberOfLines={2} style={css.nomeLancamento}>{item.descricao}</Text><Text numberOfLines={1} style={css.projetoLancamento}>{item.projeto}</Text></View>
                                    <View style={css.valorLancamento}><Text style={[css.numeroLancamento, receita && css.verde]}>{mostrarValores ? (receita ? "+ " : "− ") : ""}{mostrarValor(item.valor)}</Text><Text style={css.projetoLancamento}>{mostrarData(item.data || item.dia)}</Text></View>
                                </Pressable>
                            );
                        })}
                    </View>
                    {!carregando && !erro && dadosFinanceiros && lancamentos.length === 0 && (
                        <View style={css.semLancamentos}><Text style={css.semLancamentosTitulo}>Nenhum lançamento disponível</Text><Text style={css.semLancamentosTexto}>Toque em Receita ou Despesa para cadastrar o primeiro lançamento.</Text></View>
                    )}
                </View>
            </ScrollView>

            <MenuInferior navigation={navigation} ativo="Home" />
        </SafeAreaView>
    );
}
