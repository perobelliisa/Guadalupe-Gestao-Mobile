"""Pagamentos da Lupe: somente Flask simulado e SQLite temporário, sem banco real."""
import unittest
from unittest.mock import patch

from flask import jsonify, request
import lupe_agente_backend as base
from lupe_acoes import ErroAcao, SistemaLupe
from lupe_pagamentos import consultar_pagamentos, preparar_pix


class PagamentosTest(unittest.TestCase):
    def setUp(self):
        self.t = base.AgenteTest()
        self.t.setUp()
        self.addCleanup(self.t.doCleanups)
        self.conta = {'id_conta': 9, 'nome': 'Missão de teste', 'banco': 'Arkhé', 'client_secret': 'nunca-enviar'}
        self.codigo = 'ARKHEPIX:CODIGO-EXATO-TESTE'
        self.cobrancas = []
        self.geradas = []
        self.consultas = []
        self.pago = False
        self.falha = False
        self.configurada = True
        def conta():
            if not self.configurada: return jsonify(sucesso=False, mensagem='A integração Arkhé ainda não foi configurada no servidor.'), 503
            return jsonify(sucesso=True, conta=self.conta)
        def cobrancas():
            if not self.t.autorizado(): return jsonify(sucesso=False), 403
            if request.method == 'GET': return jsonify(sucesso=True, cobrancas=self.cobrancas)
            dados = request.get_json()
            self.geradas.append(dados)
            if self.falha: return jsonify(sucesso=False, mensagem='Falha do provedor'), 503
            item = {**dados, 'id_cobranca': 123, 'codigo_pagamento': self.codigo, 'situacao': 'pendente', 'criado_em': '2026-10-20T10:00:00', 'id_doacao': None}
            self.cobrancas.append(item)
            return jsonify(sucesso=True, cobranca=item), 201
        def status(identificador):
            self.consultas.append((request.method, str(identificador)))
            item = next(c for c in self.cobrancas if c['id'] == str(identificador))
            return jsonify(sucesso=True, cobranca={**item, 'situacao': 'pago' if self.pago else 'pendente'}, fonte='consulta_arkhe', situacao_registrada=item['situacao'], recebimento_registrado=False, consultado_em='2026-10-20T12:00:00Z')
        self.t.app.add_url_rule('/integracoes/arkhe/conta', view_func=conta)
        self.t.app.add_url_rule('/integracoes/arkhe/cobrancas', view_func=cobrancas, methods=['GET','POST'])
        self.t.app.add_url_rule('/integracoes/arkhe/cobrancas/<uuid:identificador>/status', view_func=status)

    def preparar(self, dados=None):
        with self.t.app.test_request_context('/', headers=self.t.headers):
            return preparar_pix(SistemaLupe(self.t.app), dados or {'doador':'Ana', 'valor':'50.00'})

    def propor(self, dados=None):
        return self.t.acoes.criar(7, 'conversa-1', self.preparar(dados))

    def consultar(self, dados):
        with self.t.app.test_request_context('/', headers=self.t.headers):
            return consultar_pagamentos(SistemaLupe(self.t.app), dados)

    def test_pix_so_e_gerado_depois_de_confirmar_e_uma_unica_vez(self):
        acao = self.propor()
        self.assertEqual(self.geradas, [])
        resultado = self.t.confirmar(acao).json
        self.assertEqual(resultado['acao']['estado'], 'concluida')
        self.assertIn(self.codigo, resultado['resposta'])
        self.assertIn('uso dentro da Arkhé', resultado['resposta'])
        self.assertIn('pendente', resultado['resposta'])
        self.assertIsNone(self.geradas[0]['id_projeto'])
        self.assertTrue(self.t.confirmar(acao).json['ja_processada'])
        self.assertEqual(len(self.geradas), 1)
        self.assertEqual(self.t.mutacoes, [])

    def test_cancelar_e_permissao_negada_nao_geram_cobranca(self):
        acao = self.propor()
        self.t.cliente.post('/lupe/acoes/'+acao['id']+'/cancelar', json={}, headers=self.t.headers)
        self.assertEqual(self.geradas, [])
        acao = self.propor()
        self.t.permitido = False
        self.assertEqual(self.t.confirmar(acao).status_code, 403)
        self.assertEqual(self.geradas, [])

    def test_conta_recebedora_alterada_exige_nova_proposta(self):
        acao = self.propor()
        self.conta['id_conta'] = 99
        self.assertEqual(self.t.confirmar(acao).json['acao']['estado'], 'alterada')
        self.assertEqual(self.geradas, [])

    def test_integracao_sem_configuracao_explicada_sem_criar_proposta(self):
        self.configurada = False
        with self.assertRaises(ErroAcao) as erro: self.propor()
        self.assertEqual(erro.exception.status,422)
        self.assertIn('administrador',str(erro.exception))
        self.assertEqual(self.geradas,[])
        self.assertEqual(self.t.acoes.listar(7,'conversa-1'),[])

    def test_recebedor_e_codigo_nao_podem_ser_inventados_pelo_modelo(self):
        for extra in [{'recebedor':'Outra conta'}, {'chave_pix':'inventada'}, {'id':'123'}, {'codigo_pagamento':'fake'}]:
            with self.assertRaises(ErroAcao): self.preparar({'doador':'Ana','valor':'50.00', **extra})
        self.assertEqual(self.geradas, [])

    def test_valor_livre_missao_ou_projeto_valido_na_previa(self):
        plano = self.preparar({'doador':'Ana','valor_livre':True,'id_projeto':0})
        self.assertIsNone(plano['dados']['id_projeto'])
        self.assertIsNone(plano['dados']['valor'])
        self.assertIn('Missão Guadalupe', str(plano['campos']))
        self.assertNotIn('nunca-enviar', str(plano))
        plano = self.preparar({'doador':'Ana','valor':'12.34','id_projeto':1})
        self.assertIn('Casa (#1)', str(plano['campos']))

    def test_dados_ausentes_ou_invalidos_nao_sao_propostos(self):
        for dados in [{'valor':'50'}, {'doador':'Ana'}, {'doador':'Ana','valor':'NaN'}, {'doador':'Ana','valor':'1.001'}, {'doador':'Ana','valor':'-1'}, {'doador':'Ana','valor':'2','valor_livre':True}, {'doador':'Ana','valor':'2','id_projeto':999}]:
            with self.assertRaises(ErroAcao): self.preparar(dados)
        self.assertEqual(self.geradas, [])

    def test_falha_de_criacao_nao_e_repetida_automaticamente(self):
        acao = self.propor()
        self.falha = True
        self.assertEqual(self.t.confirmar(acao).json['acao']['estado'], 'incerta')
        self.assertEqual(self.t.confirmar(acao).status_code, 409)
        self.assertEqual(len(self.geradas),1)

    def test_consulta_ao_banco_nao_grava_doacao_nem_muda_estado_local(self):
        self.t.confirmar(self.propor())
        self.pago = True
        resultado = self.consultar({'tipo':'doacao_pix','id':'123','atualizar':True})
        self.assertEqual(resultado['pagamentos'][0]['situacao'], 'pago')
        self.assertEqual(resultado['situacao_registrada'], 'pendente')
        self.assertFalse(resultado['recebimento_registrado'])
        self.assertEqual(self.consultas[0][0],'GET')
        self.assertEqual(self.cobrancas[0]['situacao'],'pendente')
        self.assertEqual(self.t.mutacoes,[])
        self.assertNotIn('codigo_pagamento', resultado['pagamentos'][0])

    def test_recupera_codigo_existente_sem_gerar_outra_cobranca(self):
        self.t.confirmar(self.propor())
        self.assertEqual(self.consultar({'tipo':'doacao_pix','id':'123','incluir_codigo':True})['pagamentos'][0]['codigo_pagamento'], self.codigo)
        self.assertEqual(len(self.geradas),1)

    def test_codigo_pago_nao_e_reoferecido_como_pendente(self):
        self.t.confirmar(self.propor())
        self.pago = True
        retorno = self.consultar({'tipo':'doacao_pix','id':'123','incluir_codigo':True})
        self.assertNotIn('codigo_pagamento',retorno['pagamentos'][0])
        self.assertEqual(retorno['pagamentos'][0]['situacao'],'pago')
        self.assertEqual(len(self.geradas),1)

    def test_consulta_lista_paginas_com_totais_antes_da_paginacao(self):
        self.t.confirmar(self.propor())
        self.cobrancas = [{**self.cobrancas[0],'id_cobranca': i, 'valor':'0.10'} for i in range(100)]
        self.cobrancas.append({**self.cobrancas[0], 'id_cobranca':101,'valor':None,'valor_livre':True})
        resultado = self.consultar({'tipo':'doacao_pix','limite':2})
        self.assertFalse(resultado['consulta_bancaria'])
        self.assertEqual(len(resultado['pagamentos']),2)
        self.assertEqual(resultado['quantidade'],101)
        grupo = resultado['resumo_todos_filtrados']['pendente']
        self.assertEqual(grupo['total_com_valor_definido'],'10.00')
        self.assertEqual(grupo['quantidade_sem_valor_definido'],1)

    def test_consulta_pagamentos_de_despesas_e_parcelas_de_emprestimos(self):
        self.t.registros['despesas'] += [{**self.t.registros['despesas'][0],'id_livro_caixa':11,'status':1}]
        resultado = self.consultar({'tipo':'despesa','situacao':'pago','forma_pagamento':2})
        self.assertEqual(resultado['pagamentos'][0]['id_livro_caixa'],11)
        self.assertEqual(resultado['quantidade'],1)
        self.t.registros['emprestimos'] = [{'id_emprestimo':1,'valor':100,'parcelas':2,'parcelas_pagas':2}]
        self.assertEqual(self.consultar({'tipo':'emprestimo','situacao':'quitado'})['quantidade'],1)
        self.assertEqual(self.geradas,[])

    def test_modelo_prepara_pix_e_resultado_fica_na_mesma_resposta_do_historico(self):
        chamada = {'role':'model','parts':[{'functionCall':{'name':'preparar_pix_doacao','args':{'doador':'Ana','valor':'50.00'}}}]}
        with patch.object(base.agente,'consultar_modelo',return_value=chamada):
            dados = self.t.cliente.post('/lupe/chat',json={'conversa_id':'conversa-1','mensagens':[{'papel':'usuario','texto':'Gere um Pix de 50 para Ana'}]},headers=self.t.headers).json
        self.assertEqual(self.geradas,[])
        self.t.banco.salvar(7,'conversa-1',{'id':'conversa-1','criadaEm':'2026-10-20T10:00:00Z','atualizadaEm':'2026-10-20T10:00:00Z','mensagens':[{'papel':'usuario','texto':'Gere um Pix de 50 para Ana'},{'papel':'lupe','texto':dados['resposta']}]})
        resultado = self.t.confirmar(dados['acoes'][-1]).json
        mensagens = resultado['conversa']['mensagens']
        self.assertEqual(len(mensagens),2)
        self.assertEqual(mensagens[-1]['texto'].count(self.codigo),1)
        self.assertNotIn('Confirmar:', str(mensagens))
        with self.t.banco.conexao() as con:
            vinculo = con.execute('SELECT usuario,conversa,cobranca FROM lupe_pix_acompanhados').fetchone()
        self.assertEqual(vinculo[:2],('7','conversa-1'))
        self.assertEqual(vinculo[2],self.geradas[0]['id'])

    def test_modelo_consulta_pagamentos_pelo_retorno_real_da_ferramenta(self):
        chamada = {'role':'model','parts':[{'functionCall':{'name':'consultar_pagamentos','args':{'tipo':'despesa','situacao':'pendente'}}}]}
        with patch.object(base.agente,'consultar_modelo',side_effect=[chamada,{'role':'model','parts':[{'text':'Você tem uma despesa pendente de R$ 100.'}]}]) as modelo:
            dados = self.t.cliente.post('/lupe/chat',json={'conversa_id':'conversa-1','mensagens':[{'papel':'usuario','texto':'Quais pagamentos estão pendentes?'}]},headers=self.t.headers).json
        resultado = modelo.call_args_list[1].args[0][-1]['parts'][0]['functionResponse']['response']['resultado']
        self.assertEqual(resultado['quantidade'],1)
        self.assertIn('100',dados['resposta'])
        self.assertEqual(self.geradas,[])

    def test_filtros_invalidos_nao_geram_requisicoes_arbitrarias(self):
        for args in [{'tipo':'sql'}, {'tipo':'doacao_pix','id':'../../usuarios','atualizar':True}, {'tipo':'doacao_pix','incluir_codigo':True}, {'tipo':'despesa','forma_pagamento':99}, {'tipo':'emprestimo','forma_pagamento':0}]:
            with self.assertRaises(ErroAcao): self.consultar(args)
        self.assertEqual(self.consultas,[])
        self.assertEqual(self.geradas,[])


if __name__ == '__main__': unittest.main()
