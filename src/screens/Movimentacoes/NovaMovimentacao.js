import AvisoErro from "../../components/AvisoErro";
import { mensagemErro } from "../../services/api";
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import Botao from "../../components/Botao";
import CampoTexto from "../../components/CampoTexto";
import Seletor from "../../components/Seletor";
import CampoData from "../../components/CampoData";
import { selecionarComprovante } from "../../services/selecionarComprovante";
import { lerComprovante } from "../../services/lerComprovante";
import { enviarComprovante } from "../../services/comprovantes";
import { cadastrarMovimentacao, editarMovimentacao, camposDaMovimentacao, listarCategorias, listarProjetos, listarMovimentacoes, montarLancamento, montarOrigens, RECORRENCIAS, prepararPagamentoDespesa, pagarVencimento, marcarDespesaPaga } from "../../services/movimentacoes";
import ConfirmarPagamento from "../../components/ConfirmarPagamento";
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

export default function NovaMovimentacao({ navigation, route, onFechar, onSalvar, onOcupado }) {
    const [rascunho, setRascunho] = useState(route.params?.rascunho || null);
    const idEdicao = route.params?.id;
    const editando = Boolean(idEdicao);
    const [registroOriginal, setRegistroOriginal] = useState(null);
    const [tipo, setTipo] = useState(route.params?.tipo === 1 ? 1 : 0);
    const [descricao, setDescricao] = useState(rascunho?.descricao || "");
    const [valor, setValor] = useState(rascunho?.valor || "");
    const [data, setData] = useState(rascunho ? rascunho.data : new Date().toLocaleDateString("pt-BR"));
    const [categoria, setCategoria] = useState(0);
    const [conta, setConta] = useState(0);
    const [formaPagamento, setFormaPagamento] = useState(rascunho ? rascunho.formaPagamento : 0);
    const [fornecedor, setFornecedor] = useState(rascunho?.fornecedor || "");
    const [origem, setOrigem] = useState("");
    const [origens, setOrigens] = useState([]);
    const [novaOrigem, setNovaOrigem] = useState("");
    const [novaCategoria, setNovaCategoria] = useState("");
    const [recorrencia, setRecorrencia] = useState(0);
    const [inicio, setInicio] = useState("");
    const [fim, setFim] = useState("");
    const [anexo, setAnexo] = useState(route.params?.anexo || null);
    const [selecionandoAnexo, setSelecionandoAnexo] = useState(false);
    const [lendoFoto, setLendoFoto] = useState(false);
    const cameraInicialAberta = useRef(false);
    const [status, setStatus] = useState(0);
    const [observacao, setObservacao] = useState("");
    const [categorias, setCategorias] = useState([]);
    const [projetos, setProjetos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erroOpcoes, setErroOpcoes] = useState("");
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const enviando = useRef(false);
    const [pagamento, setPagamento] = useState(null);
    const [preparandoPagamento, setPreparandoPagamento] = useState(false);
    const [erroPagamento, setErroPagamento] = useState("");
    const ocupado = salvando || selecionandoAnexo || lendoFoto || preparandoPagamento || Boolean(pagamento);
    const Container = onFechar ? View : SafeAreaView;

    useEffect(() => { onOcupado?.(ocupado); }, [ocupado, onOcupado]);

    async function abrirPagamento() {
        if (enviando.current || pagamento) return;
        // Não descarta silenciosamente campos que o usuário acabou de editar.
        const originais = camposDaMovimentacao(registroOriginal);
        const atuais = { descricao, valor, data, categoria, conta, formaPagamento, fornecedor, origem, recorrencia, inicio, fim, status, observacao };
        if (anexo || Object.keys(originais).some(campo => originais[campo] !== atuais[campo])) {
            setErro("Salve as alterações antes de marcar como pago.");
            return;
        }
        enviando.current = true;
        setPreparandoPagamento(true);
        setErro("");
        setErroPagamento("");
        Keyboard.dismiss();
        try {
            setPagamento(await prepararPagamentoDespesa(idEdicao));
        } catch (falha) {
            setErro(mensagemErro(falha));
        } finally {
            enviando.current = false;
            setPreparandoPagamento(false);
        }
    }

    async function confirmarPagamento() {
        if (enviando.current || !pagamento) return;
        enviando.current = true;
        setSalvando(true);
        setErroPagamento("");
        try {
            if (pagamento.recorrente) await pagarVencimento(pagamento.id, pagamento.vencimento);
            else await marcarDespesaPaga(pagamento.id, pagamento);
            setPagamento(null);
            if (onSalvar) onSalvar();
            else navigation.popTo("Movimentacoes");
        } catch (falha) {
            setErroPagamento(mensagemErro(falha));
        } finally {
            enviando.current = false;
            setSalvando(false);
        }
    }

    async function carregarOpcoes() {
        setCarregando(true);
        setErroOpcoes("");
        try {
            const [listaCategorias, listaProjetos, movimentos] = await Promise.all([listarCategorias(), listarProjetos(), listarMovimentacoes()]);
            if (editando) {
                const item = movimentos.find(item => Number(item.id_livro_caixa) === Number(idEdicao));
                if (!item) throw new Error("Este lançamento não está mais disponível.");
                const campos = camposDaMovimentacao(item);
                setRegistroOriginal(item);
                setTipo(Number(item.tipo));
                setDescricao(campos.descricao);
                setValor(campos.valor);
                setData(campos.data);
                setCategoria(campos.categoria);
                setConta(campos.conta);
                setFormaPagamento(campos.formaPagamento);
                setFornecedor(campos.fornecedor);
                setOrigem(campos.origem);
                setRecorrencia(campos.recorrencia);
                setInicio(campos.inicio);
                setFim(campos.fim);
                setStatus(campos.status);
                setObservacao(campos.observacao);
            }
            setCategorias(listaCategorias);
            setProjetos(listaProjetos);
            setOrigens(montarOrigens(movimentos));
        } catch (erroApi) {
            setErroOpcoes(mensagemErro(erroApi));
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => { carregarOpcoes(); }, [idEdicao]);

    async function preencherPelaFoto() {
        if (enviando.current || editando || tipo !== 1) return;
        enviando.current = true;
        setLendoFoto(true);
        setErro("");
        Keyboard.dismiss();
        try {
            const foto = await selecionarComprovante("camera", true);
            if (!foto) return;
            const dados = await lerComprovante(foto);
            if (dados.descricao) setDescricao(dados.descricao);
            if (dados.valor) setValor(dados.valor);
            if (dados.data) setData(dados.data);
            if (dados.fornecedor) setFornecedor(dados.fornecedor);
            if (dados.formaPagamento !== null) setFormaPagamento(dados.formaPagamento);
            setAnexo(foto);
            setRascunho(dados);
        } catch (falha) {
            Alert.alert("Leitura do comprovante", mensagemErro(falha));
        } finally {
            enviando.current = false;
            setLendoFoto(false);
        }
    }

    useEffect(() => {
        if (route.params?.tirarFoto && !carregando && !erroOpcoes && !cameraInicialAberta.current) {
            cameraInicialAberta.current = true;
            preencherPelaFoto();
        }
    }, [carregando, erroOpcoes]);

    async function escolherAnexo(origem = "arquivo") {
        if (enviando.current) return;
        enviando.current = true;
        setSelecionandoAnexo(true);
        try {
            const arquivo = await selecionarComprovante(origem);
            if (arquivo) setAnexo(arquivo);
        } catch (falha) {
            Alert.alert("Comprovante", mensagemErro(falha));
        } finally {
            enviando.current = false;
            setSelecionandoAnexo(false);
        }
    }

    async function salvar() {
        if (enviando.current || pagamento) return;
        setErro("");
        let lancamento;
        try {
            lancamento = montarLancamento(tipo, { descricao, valor, data, categoria, novaCategoria, conta, formaPagamento, origem, novaOrigem, fornecedor, observacao, status, recorrencia, inicio, fim });
        } catch (erroValidacao) {
            setErro(mensagemErro(erroValidacao));
            return;
        }

        enviando.current = true;
        setSalvando(true);
        try {
            if (editando) {
                await editarMovimentacao(idEdicao, lancamento);
                if (anexo) {
                    try {
                        const caminho = await enviarComprovante(idEdicao, anexo, Boolean(registroOriginal?.anexo));
                        setRegistroOriginal(atual => ({ ...atual, anexo: caminho }));
                        setAnexo(null);
                    } catch (falha) {
                        throw new Error("Os dados foram salvos, mas o comprovante não foi enviado. " + mensagemErro(falha) + " Tente salvar novamente.");
                    }
                }
            } else {
                await cadastrarMovimentacao(tipo, lancamento, anexo);
            }
            if (onSalvar) onSalvar();
            else {
                Alert.alert("Sucesso", editando ? "Alterações salvas!" : tipo === 0 ? "Receita cadastrada!" : "Despesa cadastrada!");
                navigation.popTo("Movimentacoes");
            }
        } catch (erroApi) {
            setErro(mensagemErro(erroApi));
        } finally {
            enviando.current = false;
            setSalvando(false);
        }
    }

    const opcoesCategorias = [...categorias.filter(item => Number(item.tipo) === tipo).map(item => ({ valor: Number(item.id_categoria), nome: item.nome })), { valor: "__nova__", nome: "+ Criar nova categoria" }];
    const opcoesProjetos = [{ valor: 0, nome: "Missão Guadalupe" }, ...projetos.map(item => ({ valor: Number(item.id_projeto), nome: item.nome }))];
    const opcoesOrigens = [...origens.map(nome => ({ valor: nome, nome })), { valor: "__nova__", nome: "+ Informar nova origem" }];

    return (
        <Container style={css.pagina}>
            {onFechar ? <View style={[css.topo, css.topoEdicao]} accessibilityElementsHidden={Boolean(pagamento)} importantForAccessibility={pagamento ? "no-hide-descendants" : "auto"}>
                <View style={{ flex: 1 }}><Text style={css.titulo}>Editar {tipo === 1 ? "despesa" : "entrada"}</Text><Text style={css.subtituloEdicao}>Atualize os dados do registro selecionado</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Fechar editor" disabled={ocupado} onPress={onFechar} style={css.voltar}><Text style={css.setaVoltar}>×</Text></Pressable>
            </View> : <View style={css.topo}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={css.voltar} disabled={ocupado} onPress={() => navigation.goBack()}><Text style={css.setaVoltar}>←</Text></Pressable><Text style={css.titulo}>{editando ? "Editar lançamento" : "Novo lançamento"}</Text></View>}
            <KeyboardAvoidingView accessibilityElementsHidden={Boolean(pagamento)} importantForAccessibility={pagamento ? "no-hide-descendants" : "auto"} style={css.teclado} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <ScrollView contentContainerStyle={css.formulario} keyboardShouldPersistTaps="handled">
                    {carregando ? <ActivityIndicator color="#326bff" /> : erroOpcoes ? (
                        <View style={css.aviso}><AvisoErro erro={erroOpcoes} /><Botao titulo="Tentar novamente" onPress={carregarOpcoes} /></View>
                    ) : (
                        <View style={css.campos} pointerEvents={ocupado ? "none" : "auto"}>
                            {tipo === 1 && rascunho && <View style={css.anexo}><Text style={css.nomeAnexo}>Confira os dados lidos do comprovante</Text><Text style={css.ajuda}>Corrija o que for necessário e escolha a categoria e a origem. A despesa será cadastrada ao salvar.</Text></View>}
                            {!onFechar && <View style={css.abas}>
                                {["Receita", "Despesa"].map((nome, indice) => <Pressable key={nome} disabled={salvando || editando} accessibilityRole="tab" accessibilityState={{ selected: tipo === indice }} onPress={() => { if (tipo !== indice) { setTipo(indice); setCategoria(0); setRascunho(null); setErro(""); } }} style={[css.aba, tipo === indice && css.abaAtiva]}><Text style={[css.textoAba, tipo === indice && (indice === 0 ? css.verde : css.vermelho)]}>{indice === 0 ? "↙  " : "↗  "}{nome}</Text></Pressable>)}
                            </View>}
                            {tipo === 1 && !editando && <View style={css.anexo}>
                                <Pressable accessibilityRole="button" disabled={ocupado} onPress={preencherPelaFoto} style={[css.salvar, { alignSelf: "stretch" }, ocupado && css.desabilitado]}>
                                    {lendoFoto ? <ActivityIndicator color="white" /> : <Text style={css.textoSalvar}>Tirar foto do comprovante</Text>}
                                </Pressable>
                                <Text style={css.ajuda}>{lendoFoto ? "Analisando a foto com o Gemini..." : "O Gemini analisa a foto para preencher a despesa."}</Text>
                            </View>}
                            <View style={[css.valorCard, tipo === 0 ? css.fundoReceita : css.fundoDespesa, onFechar && css.valorEdicao]}>
                                <Text style={css.rotulo}>{tipo === 0 ? "Valor recebido *" : "Valor *"}</Text>
                                <View style={css.linhaValor}><Text style={[css.cifra, tipo === 0 ? css.verde : css.vermelho]}>R$</Text><TextInput accessibilityLabel="Valor do lançamento" style={[css.valor, tipo === 0 ? css.verde : css.vermelho, onFechar && css.inputValorEdicao]} placeholder="0,00" placeholderTextColor="#c8d4d4" keyboardType="decimal-pad" value={valor} onChangeText={setValor} maxLength={18} editable={!salvando} /></View>
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
                                <Seletor compacto titulo={onFechar && recorrencia ? "Status do primeiro vencimento" : "Status"} opcoes={[{ valor: 0, nome: "Não pago" }, { valor: 1, nome: "Pago" }]} valor={status} onChange={novo => { if (onFechar && novo === 1 && status !== 1) abrirPagamento(); else setStatus(novo); }} desabilitado={ocupado} />
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
                                <Text style={css.nomeAnexo}>{anexo?.name || (registroOriginal?.anexo ? "Comprovante anexado" : "Nenhum arquivo selecionado")}</Text>
                                <Text style={css.ajuda}>{registroOriginal?.anexo ? "Ao salvar, o arquivo escolhido substituirá o comprovante atual." : "PDF, JPG ou PNG"}</Text>
                                {anexo?.mimeType?.startsWith("image/") && <Image source={{ uri: anexo.uri }} style={{ width: "100%", height: 180, borderRadius: 8 }} resizeMode="contain" accessibilityLabel="Foto do comprovante selecionado" />}
                                <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                                    <Pressable accessibilityRole="button" disabled={ocupado} onPress={() => escolherAnexo("arquivo")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={css.link}>Escolher arquivo</Text></Pressable>
                                    <Pressable accessibilityRole="button" disabled={ocupado} onPress={() => escolherAnexo("camera")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={css.link}>Tirar foto</Text></Pressable>
                                </View>
                                {selecionandoAnexo && <ActivityIndicator color="#326bff" />}
                                {anexo && <Pressable accessibilityRole="button" disabled={ocupado} onPress={() => setAnexo(null)}><Text style={css.link}>{registroOriginal?.anexo ? "Cancelar troca" : "Remover anexo"}</Text></Pressable>}
                            </View>
                            <Text style={css.secao}>Observações</Text>
                            <CampoTexto compacto multiline titulo="Observação" placeholder="Informações adicionais (opcional)" value={observacao} onChangeText={setObservacao} maxLength={200} />
                            {erro && !onFechar ? <AvisoErro erro={erro} /> : null}
                            {!onFechar && <View style={css.rodape}><Pressable accessibilityRole="button" disabled={salvando} onPress={salvar} style={[css.salvar, salvando && css.desabilitado]}>{salvando ? <ActivityIndicator color="#ffffff" /> : <Text style={css.textoSalvar}>{editando ? "Salvar alterações" : tipo === 0 ? "Salvar receita" : "Salvar despesa"}</Text>}</Pressable></View>}
                        </View>
                    )}
                </ScrollView>
                {onFechar && <View style={css.rodapeEdicao}>
                    {erro ? <AvisoErro erro={erro} /> : null}
                    {tipo === 1 && registroOriginal && (Number(registroOriginal.status) !== 1 || Number(registroOriginal.recorrencia)) && <Pressable accessibilityRole="button" disabled={ocupado || carregando || Boolean(erroOpcoes)} onPress={abrirPagamento} style={[css.marcarPago, ocupado && css.desabilitado]}><Text style={css.textoMarcarPago}>{preparandoPagamento ? "Consultando vencimento..." : "Marcar como pago"}</Text></Pressable>}
                    <View style={css.botoesEdicao}>
                        <Pressable accessibilityRole="button" disabled={ocupado} onPress={onFechar} style={css.cancelarEdicao}><Text style={css.textoCancelarEdicao}>Cancelar</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={ocupado || carregando || Boolean(erroOpcoes)} onPress={salvar} style={[css.salvarEdicao, (ocupado || carregando) && css.desabilitado]}>{salvando ? <ActivityIndicator color="white" /> : <Text style={css.textoSalvar}>Salvar alterações</Text>}</Pressable>
                    </View>
                </View>}
            </KeyboardAvoidingView>
            <ConfirmarPagamento pagamento={pagamento} salvando={salvando} erro={erroPagamento} onCancelar={() => setPagamento(null)} onConfirmar={confirmarPagamento} />
        </Container>
    );
}
