import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import Botao from "../../components/Botao";
import CampoTexto from "../../components/CampoTexto";
import Seletor from "../../components/Seletor";
import CampoData from "../../components/CampoData";
import * as DocumentPicker from "expo-document-picker";
import { normalizarAnexo } from "../../services/anexos";
import { cadastrarMovimentacao, listarCategorias, listarProjetos, listarMovimentacoes, montarLancamento, montarOrigens, RECORRENCIAS } from "../../services/movimentacoes";
import css from "./NovaMovimentacaoStyle";

// Códigos descritos no campo FORMA_PAGAMENTO da tabela LIVRO_CAIXA.
const formasPagamento = [
    { valor: 0, nome: "Pix" },
    { valor: 1, nome: "Crédito" },
    { valor: 2, nome: "Débito" },
    { valor: 3, nome: "Boleto" },
    { valor: 4, nome: "Parcelamento" },
    { valor: 5, nome: "Dinheiro" },
];

export default function NovaMovimentacao({ navigation, route }) {
    const [tipo, setTipo] = useState(route.params?.tipo === 1 ? 1 : 0);
    const [descricao, setDescricao] = useState("");
    const [valor, setValor] = useState("");
    const [data, setData] = useState(new Date().toLocaleDateString("pt-BR"));
    const [categoria, setCategoria] = useState(0);
    const [conta, setConta] = useState(0);
    const [formaPagamento, setFormaPagamento] = useState(0);
    const [fornecedor, setFornecedor] = useState("");
    const [origem, setOrigem] = useState("");
    const [origens, setOrigens] = useState([]);
    const [novaOrigem, setNovaOrigem] = useState("");
    const [novaCategoria, setNovaCategoria] = useState("");
    const [recorrencia, setRecorrencia] = useState(0);
    const [inicio, setInicio] = useState("");
    const [fim, setFim] = useState("");
    const [anexo, setAnexo] = useState(null);
    const [status, setStatus] = useState(0);
    const [observacao, setObservacao] = useState("");
    const [categorias, setCategorias] = useState([]);
    const [projetos, setProjetos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erroOpcoes, setErroOpcoes] = useState("");
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const enviando = useRef(false);

    async function carregarOpcoes() {
        setCarregando(true);
        setErroOpcoes("");
        try {
            const [listaCategorias, listaProjetos, movimentos] = await Promise.all([listarCategorias(), listarProjetos(), listarMovimentacoes()]);
            setCategorias(listaCategorias);
            setProjetos(listaProjetos);
            setOrigens(montarOrigens(movimentos));
        } catch (erroApi) {
            setErroOpcoes(erroApi.message);
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => { carregarOpcoes(); }, []);

    async function escolherAnexo() {
        try {
            const resultado = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], multiple: false, copyToCacheDirectory: true });
            if (!resultado.canceled) {
                setAnexo(normalizarAnexo(resultado.assets[0]));
            }
        } catch (erroArquivo) {
            Alert.alert("Anexo", erroArquivo.message);
        }
    }

    async function salvar() {
        if (enviando.current) return;
        setErro("");
        let lancamento;
        try {
            lancamento = montarLancamento(tipo, { descricao, valor, data, categoria, novaCategoria, conta, formaPagamento, origem, novaOrigem, fornecedor, observacao, status, recorrencia, inicio, fim });
        } catch (erroValidacao) {
            setErro(erroValidacao.message);
            return;
        }

        enviando.current = true;
        setSalvando(true);
        try {
            await cadastrarMovimentacao(tipo, lancamento, anexo);
            Alert.alert("Sucesso", tipo === 0 ? "Receita cadastrada!" : "Despesa cadastrada!");
            navigation.popTo("Movimentacoes");
        } catch (erroApi) {
            setErro(erroApi.message);
        } finally {
            enviando.current = false;
            setSalvando(false);
        }
    }

    const opcoesCategorias = [...categorias.filter(item => Number(item.tipo) === tipo).map(item => ({ valor: Number(item.id_categoria), nome: item.nome })), { valor: "__nova__", nome: "+ Criar nova categoria" }];
    const opcoesProjetos = [{ valor: 0, nome: "Missão Guadalupe" }, ...projetos.map(item => ({ valor: Number(item.id_projeto), nome: item.nome }))];
    const opcoesOrigens = [...origens.map(nome => ({ valor: nome, nome })), { valor: "__nova__", nome: "+ Informar nova origem" }];

    return (
        <SafeAreaView style={css.pagina}>
            <View style={css.topo}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={css.voltar} disabled={salvando} onPress={() => navigation.goBack()}><Text style={css.setaVoltar}>←</Text></Pressable><Text style={css.titulo}>Novo lançamento</Text></View>
            <KeyboardAvoidingView style={css.teclado} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <ScrollView contentContainerStyle={css.formulario} keyboardShouldPersistTaps="handled">
                    {carregando ? <ActivityIndicator color="#326bff" /> : erroOpcoes ? (
                        <View style={css.aviso}><Text style={css.erro}>{erroOpcoes}</Text><Botao titulo="Tentar novamente" onPress={carregarOpcoes} /></View>
                    ) : (
                        <View style={css.campos} pointerEvents={salvando ? "none" : "auto"}>
                            <View style={css.abas}>
                                {["Receita", "Despesa"].map((nome, indice) => <Pressable key={nome} disabled={salvando} accessibilityRole="tab" accessibilityState={{ selected: tipo === indice }} onPress={() => { if (tipo !== indice) { setTipo(indice); setCategoria(0); setErro(""); } }} style={[css.aba, tipo === indice && css.abaAtiva]}><Text style={[css.textoAba, tipo === indice && (indice === 0 ? css.verde : css.vermelho)]}>{indice === 0 ? "↙  " : "↗  "}{nome}</Text></Pressable>)}
                            </View>
                            <View style={[css.valorCard, tipo === 0 ? css.fundoReceita : css.fundoDespesa]}>
                                <Text style={css.rotulo}>{tipo === 0 ? "Valor recebido *" : "Valor *"}</Text>
                                <View style={css.linhaValor}><Text style={[css.cifra, tipo === 0 ? css.verde : css.vermelho]}>R$</Text><TextInput accessibilityLabel="Valor do lançamento" style={[css.valor, tipo === 0 ? css.verde : css.vermelho]} placeholder="0,00" placeholderTextColor="#c8d4d4" keyboardType="decimal-pad" value={valor} onChangeText={setValor} maxLength={18} editable={!salvando} /></View>
                            </View>
                            <Text style={css.secao}>{tipo === 0 ? "Detalhes do recebimento" : "Identificação"}</Text>
                            <CampoTexto compacto titulo={tipo === 0 ? "Descrição do recebimento *" : "Descrição *"} placeholder={tipo === 0 ? "Ex.: Doação recebida" : "Ex.: Compra de alimentos"} value={descricao} onChangeText={setDescricao} maxLength={200} />
                            <CampoData titulo={tipo === 0 ? "Data do recebimento *" : "Data *"} valor={data} onChange={setData} />
                            <Seletor compacto titulo="Categoria *" opcoes={opcoesCategorias} valor={categoria} onChange={setCategoria} desabilitado={salvando} />
                            {categoria !== "__nova__" && <Pressable accessibilityRole="button" disabled={salvando} style={css.criarCategoria} onPress={() => setCategoria("__nova__")}><Text style={css.link}>+ Criar nova categoria</Text></Pressable>}
                            {categoria === "__nova__" && <CampoTexto compacto titulo="Nova categoria *" placeholder={tipo === 0 ? "Ex.: doação, oferta ou evento" : "Ex.: alimentação, material ou transporte"} value={novaCategoria} onChangeText={setNovaCategoria} maxLength={100} />}
                            <Text style={css.ajuda}>Escolha uma categoria cadastrada ou crie uma nova para usar nos próximos lançamentos.</Text>
                            {tipo === 0 && <Seletor compacto titulo="Projeto ou missão em geral *" opcoes={opcoesProjetos} valor={conta} onChange={setConta} desabilitado={salvando} />}
                            <Text style={css.secao}>{tipo === 0 ? "Origem e recebimento" : "Pagamento"}</Text>
                            <Seletor compacto titulo={tipo === 0 ? "Fonte do recurso *" : "De onde veio o pagamento? *"} opcoes={opcoesOrigens} valor={origem} onChange={setOrigem} desabilitado={salvando} />
                            {origem === "__nova__" && <CampoTexto compacto titulo="Nova origem *" placeholder={tipo === 0 ? "Ex.: doador, empresa parceira ou evento" : "Ex.: caixa, banco ou transferência"} value={novaOrigem} onChangeText={setNovaOrigem} maxLength={150} />}
                            {tipo === 1 && <>
                                <CampoTexto compacto titulo="Fornecedor" placeholder="Nome ou instituição" value={fornecedor} onChangeText={setFornecedor} maxLength={100} />
                                <Seletor compacto titulo="Projeto ou casa de missão *" opcoes={opcoesProjetos} valor={conta} onChange={setConta} desabilitado={salvando} />
                            </>}
                            <Seletor compacto titulo={tipo === 0 ? "Meio de recebimento *" : "Forma de pagamento *"} opcoes={formasPagamento} valor={formaPagamento} onChange={setFormaPagamento} desabilitado={salvando} />
                            {tipo === 1 && <>
                                <Seletor compacto titulo="Status" opcoes={[{ valor: 0, nome: "Não pago" }, { valor: 1, nome: "Pago" }]} valor={status} onChange={setStatus} desabilitado={salvando} />
                                <View style={css.recorrencia}>
                                <Text style={css.secao}>Recorrência</Text>
                                <Seletor compacto titulo="Recorrência" opcoes={RECORRENCIAS} valor={recorrencia} onChange={setRecorrencia} desabilitado={salvando} />
                                <View style={css.linha}>
                                    <View style={css.metade}><CampoData titulo={recorrencia ? "Data de início *" : "Data de início"} valor={inicio} onChange={setInicio} /></View>
                                    <View style={css.metade}><CampoData titulo={recorrencia ? "Data de fim *" : "Data de fim"} valor={fim} onChange={setFim} /></View>
                                </View>
                                {recorrencia !== 0 && <Text style={css.ajuda}>A data de fim deve ficar pelo menos {RECORRENCIAS.find(item => item.valor === recorrencia).dias} dias após o início.</Text>}
                                </View>
                            </>}
                            <Text style={css.secao}>Comprovantes e anexos</Text>
                            <View style={css.anexo}>
                                <Text style={css.nomeAnexo}>{anexo?.name || "Nenhum arquivo selecionado"}</Text>
                                <Text style={css.ajuda}>PDF, JPG ou PNG</Text>
                                <Pressable accessibilityRole="button" disabled={salvando} onPress={escolherAnexo}><Text style={css.link}>Escolher arquivo</Text></Pressable>
                                {anexo && <Pressable accessibilityRole="button" disabled={salvando} onPress={() => setAnexo(null)}><Text style={css.link}>Remover anexo</Text></Pressable>}
                            </View>
                            <Text style={css.secao}>Observações</Text>
                            <CampoTexto compacto multiline titulo="Observação" placeholder="Informações adicionais (opcional)" value={observacao} onChangeText={setObservacao} maxLength={200} />
                            {erro ? <Text accessibilityRole="alert" style={css.erro}>{erro}</Text> : null}
                            <View style={css.rodape}><Pressable accessibilityRole="button" disabled={salvando} onPress={salvar} style={[css.salvar, salvando && css.desabilitado]}>{salvando ? <ActivityIndicator color="#ffffff" /> : <Text style={css.textoSalvar}>{tipo === 0 ? "Salvar receita" : "Salvar despesa"}</Text>}</Pressable></View>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
