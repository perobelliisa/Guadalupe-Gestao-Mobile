from pathlib import Path
import copy
import importlib.util
import os
import sys
import tempfile
import unittest
from flask import Flask, request

backend = Path(os.environ.get('LUPE_TEST_BACKEND', str(Path(__file__).resolve().parents[2] / 'GuadalupeGestao-Back')))
spec = importlib.util.spec_from_file_location('historico_testado', backend / 'historico_lupe.py')
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)


class HistoricoTest(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.TemporaryDirectory()
        self.addCleanup(self.pasta.cleanup)
        self.caminho = Path(self.pasta.name) / 'lupe.sqlite3'
        self.repo = modulo.HistoricoLupe(self.caminho)
        self.app = Flask(__name__)
        def identificar():
            token = request.cookies.get('access_token') or request.headers.get('Authorization', '').removeprefix('Bearer ')
            return {'celular-7': 7, 'desktop-7': 7, 'outra-8': 8}.get(token)
        modulo.registrar_historico_lupe(self.app, lambda: bool(identificar()), identificar, self.repo)
        self.celular = self.app.test_client()
        self.desktop = self.app.test_client()
        self.desktop.set_cookie('access_token', 'desktop-7')
        self.headers = {'Authorization': 'Bearer celular-7'}

    def conversa(self, identificador='conversa-1'):
        return {'id': identificador, 'revisao': 0, 'criadaEm': '2026-10-20T10:00:00.000Z', 'atualizadaEm': '2026-10-20T10:00:00.000Z', 'mensagens': [{'papel': 'usuario', 'texto': 'Como cadastrar despesa?'}, {'papel': 'lupe', 'texto': 'Toque em **Despesa**.'}]}

    def test_mobile_salva_desktop_continua_e_mobile_le_resposta(self):
        retorno = self.celular.put('/lupe/conversas/conversa-1', json=self.conversa(), headers=self.headers)
        self.assertEqual(retorno.status_code, 200)
        self.assertEqual(self.desktop.get('/lupe/conversas').json['conversas'][0]['id'], 'conversa-1')
        conversa = self.desktop.get('/lupe/conversas/conversa-1').json['conversa']
        conversa['mensagens'] += [{'papel': 'usuario', 'texto': 'E depois?'}, {'papel': 'lupe', 'texto': 'Confira e salve.'}]
        self.assertEqual(self.desktop.put('/lupe/conversas/conversa-1', json=conversa).status_code, 200)
        atual = self.celular.get('/lupe/conversas/conversa-1', headers=self.headers).json['conversa']
        self.assertEqual(len(atual['mensagens']), 4)
        self.assertEqual(atual['revisao'], 2)

    def test_outra_conta_nao_lista_le_altera_ou_exclui_conversas(self):
        self.repo.salvar(7, 'conversa-1', self.conversa())
        outra = {'Authorization': 'Bearer outra-8'}
        self.assertEqual(self.celular.get('/lupe/conversas', headers=outra).json['conversas'], [])
        self.assertEqual(self.celular.get('/lupe/conversas/conversa-1', headers=outra).status_code, 404)
        self.celular.put('/lupe/conversas/conversa-1', headers=outra, json=self.conversa())
        self.celular.delete('/lupe/conversas/conversa-1', headers=outra)
        self.assertEqual(self.repo.carregar(7, 'conversa-1')['revisao'], 1)
        self.assertEqual(self.celular.get('/lupe/conversas').status_code, 403)
        self.assertEqual(self.celular.get('/lupe/conversas', headers={**self.headers, 'X-Lupe-Usuario': '8'}).status_code, 403)

    def test_concorrencia_nao_sobrescreve_outra_versao(self):
        salva = self.repo.salvar(7, 'conversa-1', self.conversa())
        celular = copy.deepcopy(salva)
        desktop = copy.deepcopy(salva)
        desktop['mensagens'] += [{'papel': 'usuario', 'texto': 'Desktop'}, {'papel': 'lupe', 'texto': 'Resposta desktop'}]
        self.repo.salvar(7, 'conversa-1', desktop)
        celular['mensagens'] += [{'papel': 'usuario', 'texto': 'Celular'}, {'papel': 'lupe', 'texto': 'Resposta celular'}]
        erro = self.celular.put('/lupe/conversas/conversa-1', json=celular, headers=self.headers)
        self.assertEqual(erro.status_code, 409)
        self.assertEqual(self.repo.carregar(7, 'conversa-1')['mensagens'][-1]['texto'], 'Resposta desktop')

    def test_importacao_idempotente_preserva_datas_e_nao_recria_duplicatas(self):
        original = {**self.conversa(), 'importacao': True}
        primeira = self.repo.salvar(7, 'conversa-1', original)
        self.assertEqual(primeira['atualizadaEm'], original['atualizadaEm'])
        segunda = self.repo.salvar(7, 'conversa-1', original)
        self.assertEqual(segunda['revisao'], 1)
        nova = copy.deepcopy(primeira)
        nova['mensagens'] += [{'papel': 'usuario', 'texto': 'Mais'}, {'papel': 'lupe', 'texto': 'Outra resposta'}]
        self.repo.salvar(7, 'conversa-1', nova)
        self.assertEqual(self.repo.salvar(7, 'conversa-1', original)['revisao'], 2)
        self.assertEqual(len(self.repo.listar(7)), 1)

    def test_persistencia_apos_reiniciar_e_exclusao_compartilhada(self):
        salva = self.repo.salvar(7, 'conversa-1', self.conversa())
        reiniciado = modulo.HistoricoLupe(self.caminho)
        self.assertEqual(reiniciado.carregar(7, 'conversa-1')['mensagens'], salva['mensagens'])
        self.assertEqual(self.desktop.delete('/lupe/conversas/conversa-1').status_code, 200)
        self.assertEqual(self.celular.get('/lupe/conversas', headers=self.headers).json['conversas'], [])
        self.assertEqual(self.celular.put('/lupe/conversas/conversa-1', json=salva, headers=self.headers).status_code, 409)

    def test_validacao_impede_corpos_invalidos_e_mensagens_incompletas(self):
        for dados in [None, {}, {**self.conversa(), 'mensagens': [{'papel': 'usuario', 'texto': 'Oi'}]}, {**self.conversa(), 'revisao': True}, {**self.conversa(), 'criadaEm': 'texto'}]:
            resposta = self.celular.put('/lupe/conversas/conversa-1', json=dados, headers=self.headers)
            self.assertEqual(resposta.status_code, 400)
        self.assertEqual(self.repo.listar(7), [])


if __name__ == '__main__':
    unittest.main()
