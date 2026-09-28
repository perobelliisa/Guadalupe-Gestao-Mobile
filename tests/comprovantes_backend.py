"""Valida a rota local sem iniciar a API nem acessar o banco real."""
import ast
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import Mock


class ComprovantesTest(unittest.TestCase):
    def setUp(self):
        caminho = Path(__file__).resolve().parents[2] / 'GuadalupeGestao-Back' / 'livro_caixa.py'
        arvore = ast.parse(caminho.read_text(encoding='utf-8'))
        rota = next(no for no in arvore.body if isinstance(no, ast.FunctionDef) and no.name == 'salvar_comprovante_lancamento')
        rota.decorator_list = []
        self.cur = Mock()
        self.ambiente = dict(
            jsonify=lambda valor: valor, con=SimpleNamespace(cursor=lambda: self.cur),
            usuario_pode_gerenciar_doacoes=Mock(return_value=True),
            tipo_lancamento=Mock(return_value=0), localizar_anexo=Mock(return_value=''),
            salvar_anexo=Mock(return_value='/arquivos/movimentacoes/movimentacao_9.pdf'),
            request=SimpleNamespace(files={'anexo': 'arquivo'}), app=Mock(),
        )
        exec(compile(ast.Module(body=[rota], type_ignores=[]), str(caminho), 'exec'), self.ambiente)
        self.enviar = self.ambiente['salvar_comprovante_lancamento']

    def test_envio_para_registro_existente(self):
        dados, status = self.enviar(9)
        self.assertEqual(status, 200)
        self.assertTrue(dados['sucesso'])
        self.ambiente['salvar_anexo'].assert_called_once_with('arquivo', 'movimentacoes', 'movimentacao', 9)
        self.cur.close.assert_called_once()

    def test_sem_permissao(self):
        self.ambiente['usuario_pode_gerenciar_doacoes'].return_value = False
        self.assertEqual(self.enviar(9)[1], 403)
        self.ambiente['salvar_anexo'].assert_not_called()

    def test_registro_inexistente(self):
        self.ambiente['tipo_lancamento'].return_value = None
        self.assertEqual(self.enviar(9)[1], 404)
        self.ambiente['salvar_anexo'].assert_not_called()
        self.cur.close.assert_called_once()

    def test_comprovante_existente(self):
        self.ambiente['localizar_anexo'].return_value = '/arquivos/movimentacoes/movimentacao_9.pdf'
        self.assertEqual(self.enviar(9)[1], 409)
        self.ambiente['salvar_anexo'].assert_not_called()

    def test_arquivo_ausente_ou_invalido(self):
        self.ambiente['salvar_anexo'].return_value = None
        self.assertEqual(self.enviar(9)[1], 400)
        self.ambiente['salvar_anexo'].side_effect = ValueError('Formato inválido')
        self.assertEqual(self.enviar(9)[1], 400)

    def test_falha_ao_salvar(self):
        self.ambiente['salvar_anexo'].side_effect = OSError('Sem espaço')
        self.assertEqual(self.enviar(9)[1], 500)
        self.cur.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
