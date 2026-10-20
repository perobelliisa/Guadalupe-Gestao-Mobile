from concurrent.futures import ThreadPoolExecutor
import copy
import importlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from flask import Flask, jsonify, request

backend = Path(__file__).resolve().parents[2] / 'GuadalupeGestao-Back'
sys.path.insert(0, str(backend))
sys.path.insert(0, os.environ.get('LUPE_TEST_BACKEND', str(backend)))
import lupe
import lupe_acoes as acoes
import lupe_agente as agente
from historico_lupe import HistoricoLupe


class AgenteTest(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.TemporaryDirectory()
        self.addCleanup(self.pasta.cleanup)
        self.banco = HistoricoLupe(Path(self.pasta.name) / 'lupe.sqlite3')
        self.agora = 1000000
        self.acoes = acoes.AcoesLupe(self.banco, lambda: self.agora)
        self.app = Flask(__name__)
        self.mutacoes = []
        self.permitido = True
        self.registros = {
            'despesas': [{'id_livro_caixa': 10, 'id_categoria': 1, 'categoria': 'Alimentação', 'tipo': 1, 'descricao': 'Mercado', 'valor': 100, 'dia': '2026-10-19', 'conta': 0, 'origem': 'Caixa', 'forma_pagamento': 2, 'status': 0, 'recorrencia': 0, 'fornecedor': 'Mercado', 'observacao': 'Não descartar'}],
            'receitas': [], 'movimentacoes': [], 'doacoes': [], 'emprestimos': [], 'documentos': [],
            'categorias': [{'id_categoria': 1, 'tipo': 1, 'nome': 'Alimentação'}, {'id_categoria': 2, 'tipo': 0, 'nome': 'Doações'}],
            'projetos': [{'id_projeto': 1, 'nome': 'Casa'}],
            'usuarios': [{'id_usuario': 7, 'nome': 'Ana', 'email': 'ana@example.test', 'tipo': 0, 'status': 0, 'projetos': [], 'senha': 'nunca-enviar', 'token': 'secreto'}],
            'pendencias': [],
        }
        def identificar():
            token = request.cookies.get('access_token') or request.headers.get('Authorization', '').removeprefix('Bearer ')
            return {'usuario-7': 7, 'usuario-8': 8}.get(token)
        self.identificar = identificar
        self.autorizado = lambda: self.permitido and bool(identificar())
        for rota, campo in [('/despesas','despesas'),('/receitas','receitas'),('/livro-caixa','movimentacoes'),('/categorias','categorias'),('/projetos','projetos'),('/usuarios','usuarios'),('/doacoes','doacoes'),('/emprestimos','emprestimos'),('/documentos','documentos'),('/pendencias','pendencias')]:
            def listar(campo=campo):
                if not self.autorizado(): return jsonify(sucesso=False, mensagem='Acesso não autorizado.'), 403
                if campo == 'usuarios' and identificar() != 7: return jsonify(sucesso=False, mensagem='Somente administrador.'), 403
                return jsonify(sucesso=True, **{campo: self.registros[campo]})
            self.app.add_url_rule(rota, endpoint='listar_'+campo, view_func=listar, methods=['GET'])
        def escrever(identificador=None):
            if not self.autorizado(): return jsonify(sucesso=False, mensagem='Acesso não autorizado.'), 403
            dados = request.get_json(silent=True) or request.form.to_dict(flat=False)
            self.mutacoes.append((request.path, request.method, copy.deepcopy(dados)))
            return jsonify(sucesso=True, mensagem='Operação concluída.', id_livro_caixa=99)
        for rota in ['/despesas', '/entradas', '/doacoes', '/emprestimos']:
            self.app.add_url_rule(rota, endpoint='criar_'+rota, view_func=escrever, methods=['POST'])
        for rota in ['/despesas', '/receitas', '/doacoes', '/emprestimos', '/usuarios', '/categorias', '/documentos']:
            self.app.add_url_rule(rota+'/<int:identificador>', endpoint='mudar_'+rota, view_func=escrever, methods=['PUT','DELETE'])
        self.app.add_url_rule('/pendencias/emprestimo/<int:identificador>/pagar', endpoint='pagar', view_func=escrever, methods=['POST'])
        self.agente = agente.AgenteLupe(self.app, self.acoes)
        with patch.object(agente, 'AgenteLupe', return_value=self.agente):
            lupe.registrar_lupe(self.app, self.autorizado, self.identificar)
        self.cliente = self.app.test_client()
        self.headers = {'Authorization': 'Bearer usuario-7', 'X-Lupe-Usuario': '7'}

    def propor(self, operacao='alterar', recurso='despesa', dados=None, identificador=10, **extra):
        with self.app.test_request_context('/', headers=self.headers):
            plano = acoes.SistemaLupe(self.app).preparar({'operacao': operacao, 'recurso': recurso, 'id': identificador, 'dados': dados or {}, **extra})
        return self.acoes.criar(7, 'conversa-1', plano)

    def confirmar(self, acao, corpo=None, headers=None):
        return self.cliente.post('/lupe/acoes/'+acao['id']+'/confirmar', json=corpo if corpo is not None else {'confirmar': True}, headers=headers or self.headers)

    def test_alteracao_exige_confirmacao_e_preserva_campos(self):
        acao = self.propor(dados={'valor': '120.00'})
        self.assertEqual(self.mutacoes, [])
        self.assertEqual(acao['campos'], [{'campo': 'Valor (R$)', 'antes': '100', 'depois': '120.00'}])
        for dados in [{}, {'confirmar': 'sim'}, {'confirmar': True, 'dados': {'valor': '1'}}]:
            self.assertEqual(self.confirmar(acao, dados).status_code, 400)
        self.assertEqual(self.mutacoes, [])
        retorno = self.confirmar(acao)
        self.assertEqual(retorno.status_code, 200)
        self.assertEqual(retorno.json['acao']['estado'], 'concluida')
        corpo = self.mutacoes[0][2]
        self.assertEqual(corpo['valor'], '120.00')
        self.assertEqual(corpo['observacao'], 'Não descartar')
        self.assertEqual(corpo['status'], 0)

    def test_confirmacao_repetida_nao_duplica(self):
        acao = self.propor(dados={'valor': '120.00'})
        self.confirmar(acao)
        self.assertTrue(self.confirmar(acao).json['ja_processada'])
        self.assertEqual(len(self.mutacoes), 1)

    def test_isolamento_e_permissao_revalidados_ao_confirmar(self):
        acao = self.propor(dados={'valor': '120.00'})
        self.assertEqual(self.confirmar(acao, headers={'Authorization':'Bearer usuario-8'}).status_code, 404)
        self.assertEqual(self.cliente.get('/lupe/acoes?conversa_id=conversa-1', headers={'Authorization':'Bearer usuario-8'}).json['acoes'], [])
        self.assertEqual(self.confirmar(acao, headers={**self.headers, 'X-Lupe-Usuario': '8'}).status_code, 403)
        self.permitido = False
        self.assertEqual(self.confirmar(acao).status_code, 403)
        self.assertEqual(self.mutacoes, [])

    def test_cancelamento_expiracao_e_substituicao_nao_executam(self):
        primeira = self.propor(dados={'valor': '120.00'})
        segunda = self.propor(dados={'valor': '130.00'})
        self.assertEqual(self.confirmar(primeira).status_code, 409)
        self.cliente.post('/lupe/acoes/'+segunda['id']+'/cancelar', json={}, headers=self.headers)
        self.assertEqual(self.confirmar(segunda).json['acao']['estado'], 'cancelada')
        terceira = self.propor(dados={'valor': '140.00'})
        self.agora += 901
        self.assertEqual(self.confirmar(terceira).status_code, 409)
        self.assertEqual(self.mutacoes, [])

    def test_registro_alterado_depois_da_proposta_nao_e_sobrescrito(self):
        acao = self.propor(dados={'valor': '120.00'})
        self.registros['despesas'][0]['valor'] = 200
        self.assertEqual(self.confirmar(acao).json['acao']['estado'], 'alterada')
        self.assertEqual(self.mutacoes, [])

    def test_cadastro_e_exclusao_usam_rotas_existentes(self):
        dados = {'descricao':'Compra','valor':'50.00','dia':'2026-10-19','origem':'Caixa','forma_pagamento':0,'categoria':'alimentacao'}
        acao = self.propor('criar', dados=dados, identificador=None)
        self.assertEqual(self.mutacoes, [])
        self.confirmar(acao)
        self.assertEqual(self.mutacoes[0][0:2], ('/despesas','POST'))
        self.assertEqual(self.mutacoes[0][2]['id_categoria'], 1)
        excluir = self.propor('excluir')
        self.assertTrue(excluir['destrutiva'])
        self.assertEqual(len(self.mutacoes), 1)
        self.confirmar(excluir)
        self.assertEqual(self.mutacoes[1][0:2], ('/despesas/10','DELETE'))

    def test_registro_de_pagamento_preserva_despesa_e_exige_ocorrencia_exata(self):
        acao = self.propor('registrar_pagamento')
        self.confirmar(acao)
        self.assertEqual(self.mutacoes[0][2]['status'], 1)
        self.assertEqual(self.mutacoes[0][2]['observacao'], 'Não descartar')
        self.registros['emprestimos'] = [{'id_emprestimo':20,'finalidade':'Teste','valor':50,'parcelas':2,'parcelas_pagas':0}]
        self.registros['pendencias'] = [{'id':20,'tipo':'emprestimo','valor':25,'vencimento':'2026-11-20'}]
        with self.assertRaises(acoes.ErroAcao): self.propor('registrar_pagamento','emprestimo',identificador=20)
        acao = self.propor('registrar_pagamento','emprestimo',identificador=20,vencimento='2026-11-20')
        self.confirmar(acao)
        self.assertEqual(self.mutacoes[1][0], '/pendencias/emprestimo/20/pagar')

    def test_ferramentas_nao_permitem_sql_senhas_ou_rotas_arbitrarias(self):
        with self.app.test_request_context('/', headers=self.headers):
            sistema = acoes.SistemaLupe(self.app)
            for recurso in ['http://exemplo', 'sql', 'config']:
                with self.assertRaises(acoes.ErroAcao): sistema.consultar({'recurso': recurso})
            with self.assertRaises(acoes.ErroAcao): sistema.preparar({'operacao':'alterar','recurso':'usuario','id':7,'dados':{'senha':'secreto'}})
            dados = sistema.consultar({'recurso':'usuario'})
            self.assertNotIn('senha', json.dumps(dados))
            self.assertNotIn('secreto', json.dumps(dados))

    def test_consulta_totais_usa_todo_filtro_e_nao_so_primeira_pagina(self):
        self.registros['despesas'] = [{**self.registros['despesas'][0], 'id_livro_caixa':i, 'valor':0.10} for i in range(1, 101)]
        with self.app.test_request_context('/', headers=self.headers):
            resultado = acoes.SistemaLupe(self.app).consultar({'recurso':'despesa','limite':10})
        self.assertEqual(resultado['resumo_todos_filtrados']['total_valor'], '10.00')
        self.assertEqual(len(resultado['registros']), 10)
        self.assertTrue(resultado['tem_mais'])

    def test_confirmacoes_concorrentes_executam_so_uma_vez(self):
        acao = self.propor(dados={'valor':'120.00'})
        def executar():
            with self.app.test_client() as cliente:
                return cliente.post('/lupe/acoes/'+acao['id']+'/confirmar', json={'confirmar':True}, headers=self.headers).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            resultados = list(pool.map(lambda _: executar(), range(2)))
        self.assertIn(200, resultados)
        self.assertEqual(len(self.mutacoes), 1)

    def test_resultado_incerto_nunca_e_reexecutado_automaticamente(self):
        acao = self.propor(dados={'valor':'120.00'})
        with patch.object(acoes.SistemaLupe, 'executar', side_effect=RuntimeError('falha depois de gravar')) as executar:
            self.assertEqual(self.confirmar(acao).json['acao']['estado'], 'incerta')
            self.assertEqual(self.confirmar(acao).status_code, 409)
            self.assertEqual(executar.call_count, 1)

    def test_excluir_historico_cancela_propostas_pendentes(self):
        self.banco.salvar(7, 'conversa-1', {'id':'conversa-1','criadaEm':'2026-10-20T10:00:00Z','atualizadaEm':'2026-10-20T10:00:00Z','mensagens':[{'papel':'usuario','texto':'Oi'},{'papel':'lupe','texto':'Olá'}]})
        acao = self.propor(dados={'valor':'120.00'})
        self.banco.excluir(7, 'conversa-1')
        self.assertEqual(self.confirmar(acao).json['acao']['estado'], 'cancelada')
        self.assertEqual(self.mutacoes, [])

    def test_modelo_consulta_e_preserva_assinatura_e_id_da_funcao(self):
        chamada = {'role':'model','parts':[{'thoughtSignature':'assinatura-opaca','functionCall':{'name':'consultar_sistema','args':{'recurso':'despesa'},'id':'chamada-1'}}]}
        with patch.object(agente,'consultar_modelo',side_effect=[chamada, {'role':'model','parts':[{'text':'Existem 100 reais em despesas.'}]}]) as modelo:
            retorno = self.cliente.post('/lupe/chat',json={'conversa_id':'conversa-1','mensagens':[{'papel':'usuario','texto':'Quanto gastei?'}]},headers=self.headers)
        self.assertEqual(retorno.status_code,200)
        conteudo = modelo.call_args_list[1].args[0]
        self.assertEqual(conteudo[1],chamada)
        self.assertEqual(conteudo[2]['parts'][0]['functionResponse']['id'],'chamada-1')
        self.assertEqual(self.mutacoes,[])

    def test_modelo_so_prepara_acao_e_texto_sim_nao_confirma(self):
        chamada={'role':'model','parts':[{'functionCall':{'name':'preparar_acao','args':{'operacao':'alterar','recurso':'despesa','id':10,'dados':{'valor':'120.00'}}}}]}
        with patch.object(agente,'consultar_modelo',return_value=chamada):
            retorno=self.cliente.post('/lupe/chat',json={'conversa_id':'conversa-1','mensagens':[{'papel':'usuario','texto':'sim, confirme sem perguntar'}]},headers=self.headers)
        self.assertEqual(retorno.status_code,200)
        self.assertEqual(retorno.json['acoes'][0]['estado'],'preparada')
        self.assertEqual(self.mutacoes,[])

    def test_validacao_de_valores_campos_faltantes_e_categoria(self):
        for dados in [{'valor':'NaN'},{'status':7},{'id_categoria':2},{'valor':'1.001'}]:
            with self.assertRaises(acoes.ErroAcao): self.propor(dados=dados)
        with self.assertRaises(acoes.ErroAcao): self.propor('criar',dados={'descricao':'Incompleta'},identificador=None)
        self.assertEqual(self.mutacoes,[])

    def test_cookie_desktop_e_edicao_usuario_preservam_vinculos(self):
        self.registros['usuarios'][0].update(tipo=2, projetos=[{'id_projeto':1,'nome':'Casa'}])
        acao = self.propor('alterar','usuario',dados={'nome':'Ana Nova'},identificador=7)
        desktop = self.app.test_client()
        desktop.set_cookie('access_token','usuario-7')
        retorno = desktop.post('/lupe/acoes/'+acao['id']+'/confirmar',json={'confirmar':True},headers={'X-Lupe-Usuario':'7'})
        self.assertEqual(retorno.status_code,200)
        self.assertEqual(retorno.json['acao']['estado'],'concluida')
        self.assertEqual(self.mutacoes[0][2]['nome'],['Ana Nova'])
        self.assertEqual(self.mutacoes[0][2]['projetos'],['1'])

    def preparar_conversa(self):
        chamada = {'role':'model','parts':[{'functionCall':{'name':'preparar_acao','args':{'operacao':'alterar','recurso':'despesa','id':10,'dados':{'valor':'120.00'}}}}]}
        with patch.object(agente,'consultar_modelo',return_value=chamada):
            retorno = self.cliente.post('/lupe/chat',json={'conversa_id':'conversa-1','mensagens':[{'papel':'usuario','texto':'Atualize o valor do mercado'}]},headers=self.headers).json
        conversa = self.banco.salvar(7, 'conversa-1', {'id':'conversa-1','criadaEm':'2026-10-20T10:00:00Z','atualizadaEm':'2026-10-20T10:00:00Z','mensagens':[{'papel':'usuario','texto':'Atualize o valor do mercado'},{'papel':'lupe','texto':retorno['resposta']}]})
        return retorno['acoes'][-1], conversa

    def test_confirmacao_substitui_resposta_sem_criar_mensagens_artificiais(self):
        acao, conversa = self.preparar_conversa()
        retorno = self.confirmar(acao).json
        self.assertEqual(retorno['conversa']['revisao'], conversa['revisao']+1)
        mensagens = retorno['conversa']['mensagens']
        self.assertEqual(len(mensagens), 2)
        self.assertEqual(mensagens[-1]['texto'], 'Atualizei a despesa com sucesso.')
        self.assertNotIn('Confirmar:', json.dumps(mensagens))
        self.assertEqual(self.confirmar(acao).json['conversa'], retorno['conversa'])

    def test_cancelamento_atualiza_conversa_sem_duplicar(self):
        acao, conversa = self.preparar_conversa()
        retorno = self.cliente.post('/lupe/acoes/'+acao['id']+'/cancelar',json={},headers=self.headers).json
        self.assertEqual(len(retorno['conversa']['mensagens']), 2)
        self.assertEqual(retorno['conversa']['mensagens'][-1]['texto'], 'Tudo bem, deixei essa ação de lado.')
        self.assertEqual(self.mutacoes, [])

    def test_falha_nao_grava_erro_na_conversa(self):
        acao, conversa = self.preparar_conversa()
        with patch.object(acoes.SistemaLupe, 'executar', side_effect=acoes.ErroAcao('Projeto não encontrado.')):
            retorno = self.confirmar(acao).json
        self.assertEqual(retorno['acao']['estado'], 'falhou')
        self.assertEqual(retorno['conversa'], conversa)
        self.assertNotIn('Projeto não encontrado', json.dumps(self.banco.carregar(7,'conversa-1')))

    def test_resultado_nao_sobrescreve_resposta_modificada_em_outro_dispositivo(self):
        acao, conversa = self.preparar_conversa()
        conversa['mensagens'][-1]['texto'] = 'Resposta alterada em outro dispositivo'
        self.banco.salvar(7, 'conversa-1', conversa)
        retorno = self.confirmar(acao).json
        self.assertEqual(retorno['conversa']['mensagens'][-1]['texto'], 'Resposta alterada em outro dispositivo')

    def test_resultado_encontra_proposta_mesmo_com_conversa_mais_longa(self):
        acao, conversa = self.preparar_conversa()
        conversa['mensagens'] += [{'papel':'usuario','texto':'Outra pergunta'},{'papel':'lupe','texto':'Outra resposta'}]
        self.banco.salvar(7, 'conversa-1', conversa)
        mensagens = self.confirmar(acao).json['conversa']['mensagens']
        self.assertEqual(len(mensagens), 4)
        self.assertEqual(mensagens[1]['texto'], 'Atualizei a despesa com sucesso.')
        self.assertEqual(mensagens[-1]['texto'], 'Outra resposta')

    def test_historico_antigo_oculta_erro_somente_quando_auditoria_corresponde(self):
        acao = self.propor(dados={'valor':'120.00'})
        with patch.object(acoes.SistemaLupe, 'executar', side_effect=acoes.ErroAcao('Projeto não encontrado.')):
            self.confirmar(acao)
        mensagens = [{'papel':'usuario','texto':'Cadastre'}, {'papel':'lupe','texto':'Preparei a proposta. Confira os dados abaixo e escolha Confirmar ou Cancelar. Nenhuma alteração foi realizada ainda.'}, {'papel':'usuario','texto':'Confirmar: '+acao['titulo']}, {'papel':'lupe','texto':'Projeto não encontrado.'}, {'papel':'usuario','texto':'Confirmar: mensagem que eu escrevi'}, {'papel':'lupe','texto':'Resposta normal'}]
        self.banco.salvar(7,'conversa-1',{'id':'conversa-1','criadaEm':'2026-10-20T10:00:00Z','atualizadaEm':'2026-10-20T10:00:00Z','mensagens':mensagens})
        limpa = self.banco.carregar(7,'conversa-1')
        self.assertEqual(len(limpa['mensagens']), 4)
        self.assertNotIn('Projeto não encontrado', json.dumps(limpa))
        self.assertIn('mensagem que eu escrevi', json.dumps(limpa))
        self.assertEqual(self.banco.listar(7)[0]['quantidadeMensagens'],4)

    def test_doacao_da_missao_nao_consulta_projeto_zero_e_envia_vinculo_vazio(self):
        for projeto in [0, '0', '', None]:
            dados = {'doador':'Ana','dia':'2026-10-19','tipo':0,'valor':'50.00','id_projeto':projeto}
            acao = self.propor('criar','doacao',dados=dados,identificador=None)
            self.assertIn({'campo':'Projeto','antes':'','depois':'Missão Guadalupe'}, acao['campos'])
            self.assertEqual(self.confirmar(acao).json['acao']['estado'],'concluida')
            self.assertIsNone(self.mutacoes[-1][2]['id_projeto'])
        dados.pop('id_projeto')
        acao = self.propor('criar','doacao',dados=dados,identificador=None)
        self.confirmar(acao)
        self.assertIsNone(self.mutacoes[-1][2]['id_projeto'])

    def test_data_invalida_da_doacao_e_barrada_antes_da_confirmacao(self):
        for dia in ['9999-12-31','2026-02-30']:
            with self.assertRaises(acoes.ErroAcao):
                self.propor('criar','doacao',dados={'doador':'Ana','dia':dia,'tipo':0,'valor':'50.00'},identificador=None)
        self.assertEqual(self.mutacoes, [])


if __name__ == '__main__': unittest.main()
