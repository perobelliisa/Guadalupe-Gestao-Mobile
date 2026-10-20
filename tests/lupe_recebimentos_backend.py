"""Agradecimentos automáticos com SQLite temporário, sem pagamentos reais."""
from concurrent.futures import ThreadPoolExecutor
import json
import importlib.util
import ast
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import lupe_agente_backend as base
from historico_lupe import HistoricoLupe
from lupe_recebimentos import RecebimentosLupe

COBRANCA = '11111111-1111-4111-8111-111111111111'


class RecebimentosTest(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.TemporaryDirectory()
        self.addCleanup(self.pasta.cleanup)
        self.banco = HistoricoLupe(Path(self.pasta.name)/'lupe.sqlite3')
        self.agora = 1000
        self.pago = False
        self.chamadas = []
        self.cobranca = {'id':COBRANCA,'id_cobranca':184,'doador':'Ana','valor':50,'situacao':'pendente','id_doacao':None}
        def consultar(identificador):
            self.chamadas.append(identificador)
            return {**self.cobranca,'situacao':'pago' if self.pago else 'pendente','id_doacao':90 if self.pago else None}
        self.servico = RecebimentosLupe(consultar,self.banco,lambda:self.agora)
        self.salvar()

    def salvar(self, mensagens=None, revisao=0):
        return self.banco.salvar(7,'conversa-1',{'id':'conversa-1','revisao':revisao,'criadaEm':'2026-10-20T10:00:00Z','atualizadaEm':'2026-10-20T10:00:00Z','mensagens':mensagens or [{'papel':'usuario','texto':'Gere um código'},{'papel':'lupe','texto':'Aqui está o código. Aguardando pagamento.'}]})

    def test_pendente_nao_agradece_e_pago_envia_uma_so_vez(self):
        self.servico.acompanhar(7,COBRANCA,'conversa-1')
        self.servico.processar()
        self.assertEqual(self.banco.carregar(7,'conversa-1')['avisos'],[])
        self.pago = True; self.agora += 5
        self.servico.processar(); self.servico.processar()
        conversa = self.banco.carregar(7,'conversa-1')
        self.assertEqual(len(conversa['avisos']),1)
        self.assertIn('Recebemos R$ 50,00',conversa['avisos'][0]['texto'])
        self.assertIn('Muito obrigado',conversa['avisos'][0]['texto'])
        self.assertEqual(conversa['avisos'][0]['aposMensagem'],2)
        self.assertEqual(len(conversa['mensagens']),2)

    def test_duas_instancias_nao_duplicam_agradecimento(self):
        self.servico.acompanhar(7,COBRANCA,'conversa-1')
        self.pago = True
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _:self.servico.processar(),range(2)))
        self.assertEqual(len(self.banco.carregar(7,'conversa-1')['avisos']),1)

    def test_aviso_nao_causa_conflito_ao_salvar_rascunho_de_outro_dispositivo(self):
        conversa = self.banco.carregar(7,'conversa-1')
        self.servico.acompanhar(7,COBRANCA,'conversa-1'); self.pago=True
        self.servico.processar()
        resultado = self.salvar(conversa['mensagens']+[{'papel':'usuario','texto':'Obrigado'},{'papel':'lupe','texto':'Disponha!'}],conversa['revisao'])
        self.assertEqual(len(resultado['avisos']),1)
        self.assertEqual(len(resultado['mensagens']),4)
        self.assertEqual(resultado['avisos'][0]['aposMensagem'],2)

    def test_falha_de_rede_nao_agradece_e_e_reconsultada(self):
        self.servico.acompanhar(7,COBRANCA,'conversa-1')
        with patch.object(self.servico,'consultar',side_effect=RuntimeError('sem resposta')):
            self.servico.processar()
        self.assertEqual(self.banco.carregar(7,'conversa-1')['avisos'],[])
        self.pago=True; self.agora+=60; self.servico.processar()
        self.assertEqual(len(self.banco.carregar(7,'conversa-1')['avisos']),1)

    def test_nao_agradece_recebimento_sem_registro_financeiro(self):
        self.servico.acompanhar(7,COBRANCA,'conversa-1')
        self.servico.consultar = lambda _: {**self.cobranca,'situacao':'pago','id_doacao':None}
        self.servico.processar()
        self.assertEqual(self.banco.carregar(7,'conversa-1')['avisos'],[])

    def test_nova_conversa_de_recebimentos_sem_usuario_falso(self):
        self.servico.acompanhar(8,COBRANCA)
        self.pago=True; self.servico.processar()
        lista = self.banco.listar(8)
        self.assertEqual(len(lista),1)
        self.assertEqual(lista[0]['titulo'],'Recebimentos de doações')
        conversa = self.banco.carregar(8,lista[0]['id'])
        self.assertEqual(conversa['mensagens'],[])
        self.assertEqual(len(conversa['avisos']),1)
        self.assertEqual(self.banco.carregar(7,'conversa-1')['avisos'],[])

    def test_excluir_conversa_nao_a_recria_ao_receber(self):
        self.servico.acompanhar(7,COBRANCA,'conversa-1')
        self.banco.excluir(7,'conversa-1')
        self.pago=True; self.servico.processar()
        self.assertEqual(self.banco.listar(7),[])

    def test_mensagem_persiste_ao_reabrir_e_meta_avisa_sincronizacao(self):
        self.servico.acompanhar(7,COBRANCA,'conversa-1')
        antes = self.banco.listar(7)[0]
        self.pago=True; self.servico.processar()
        nova = HistoricoLupe(self.banco.caminho)
        depois = nova.listar(7)[0]
        self.assertEqual(antes['revisao'],depois['revisao'])
        self.assertGreater(depois['revisaoAvisos'],antes['revisaoAvisos'])
        self.assertIn('Recebemos',depois['resumo'])
        self.assertEqual(len(nova.carregar(7,'conversa-1')['avisos']),1)

    def test_modelo_recebe_contexto_do_pagamento_confirmado(self):
        t=base.AgenteTest(); t.setUp(); self.addCleanup(t.doCleanups)
        self.servico.acompanhar(7,COBRANCA,'conversa-1'); self.pago=True; self.servico.processar()
        t.agente.acoes.banco=self.banco
        with patch.object(base.agente,'consultar_modelo',return_value={'role':'model','parts':[{'text':'Recebimento confirmado!'}]}) as modelo:
            with t.app.test_request_context('/',headers=t.headers):
                t.agente.conversar([{'papel':'usuario','texto':'Já chegou?'}],7,'conversa-1')
        self.assertIn('Recebemos R$ 50,00',modelo.call_args.args[2])

    def test_integracao_so_agradece_depois_do_commit_da_doacao_e_livro(self):
        spec = importlib.util.spec_from_file_location('arkhe_fixture', base.backend/'tests'/'test_arkhe.py')
        fixture = importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)
        t = fixture.ArkheTest(); t.setUp(); self.addCleanup(t.tearDown)
        from flask import Flask
        from arkhe import registrar_arkhe
        app = Flask('avisos_integrados')
        consultar = registrar_arkhe(app,t.abrir,lambda:True,t.lancar,t.banco,acompanhar=lambda c:self.servico.acompanhar(7,c['id'],'conversa-1'))
        self.servico.consultar = consultar
        self.assertEqual(app.test_client().post('/integracoes/arkhe/cobrancas',json=t.payload).status_code,201)
        t.banco.pago=True; t.falhar_livro=True
        self.servico.processar()
        self.assertEqual(t.contagens(),(0,0))
        self.assertEqual(self.banco.carregar(7,'conversa-1')['avisos'],[])
        t.falhar_livro=False; self.agora+=60
        self.servico.processar(); self.servico.processar()
        self.assertEqual(t.contagens(),(1,1))
        self.assertEqual(len(self.banco.carregar(7,'conversa-1')['avisos']),1)

    def test_lancamento_automatico_funciona_sem_requisicao_http(self):
        from flask import Flask, request, has_request_context
        from unittest.mock import Mock
        caminho = Path(os.environ.get('LUPE_TEST_BACKEND',str(base.backend)))/'function.py'
        arvore = ast.parse(caminho.read_text(encoding='utf-8'))
        funcao = next(n for n in arvore.body if isinstance(n,ast.FunctionDef) and n.name=='inserir_lancamento')
        anexo = Mock()
        contexto = {'request':request,'has_request_context':has_request_context,'salvar_anexo':anexo}
        exec(compile(ast.Module(body=[funcao],type_ignores=[]),str(caminho),'exec'),contexto)
        cur = Mock(); cur.fetchone.return_value = [99]
        dados = dict.fromkeys(('id_categoria','descricao','valor','data','vencimento','fornecedor','status','recorrencia','dia_inicio','dia_fim','conta','origem','forma_pagamento','observacao'))
        self.assertEqual(contexto['inserir_lancamento'](cur,dados,0),99)
        anexo.assert_not_called()
        with Flask('teste_anexo').test_request_context('/'):
            self.assertEqual(contexto['inserir_lancamento'](cur,dados,0),99)
        anexo.assert_called_once_with(None,'movimentacoes','movimentacao',99)


if __name__=='__main__': unittest.main()
