import ast
import io
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch
from PIL import Image, ImageDraw, ImageFont
from werkzeug.datastructures import FileStorage

backend = Path(__file__).resolve().parents[2] / 'GuadalupeGestao-Back'
leitura = types.ModuleType('leitura_comprovante')
leitura.__file__ = str(backend / 'leitura_comprovante.py')
exec(compile((backend / 'leitura_comprovante.py').read_text(encoding='utf-8'), leitura.__file__, 'exec'), leitura.__dict__)

class LeituraTest(unittest.TestCase):
    def dados(self, **mudancas):
        return dict(comprovante_legivel=True, descricao='Compra no mercado', fornecedor='Mercado',valor='150.00',dia='2026-10-06',forma_pagamento=0, **mudancas)

    def test_valida_dados_sem_presumir_categoria_pagamento(self):
        dados=leitura.validar_dados({**self.dados(), 'status':1,'id_categoria':4})
        self.assertEqual(dados['valor'],'150.00')
        self.assertEqual(dados['forma_pagamento'],0)
        self.assertNotIn('status',dados)
        self.assertNotIn('id_categoria',dados)

    def test_dados_invalidos_ficam_vazios(self):
        dados=leitura.validar_dados({**self.dados(), 'valor':'-50.00','dia':'2026-02-31','forma_pagamento':True,'fornecedor':{}})
        self.assertIsNone(dados['valor']); self.assertIsNone(dados['dia'])
        self.assertIsNone(dados['forma_pagamento']); self.assertEqual(dados['fornecedor'],'')

    def test_comprovante_ilegivel_nao_preenche(self):
        with self.assertRaises(ValueError):
            leitura.validar_dados({'comprovante_legivel':False})
        with self.assertRaises(leitura.ErroLeitura):
            leitura.validar_dados([])

    def test_limites_valor_textos(self):
        for valor in ['NaN','Infinity','90071992547409.92','150.000','150,00','0.00']:
            self.assertIsNone(leitura.validar_dados({**self.dados(), 'valor':valor})['valor'])
        self.assertEqual(len(leitura.validar_dados({**self.dados(), 'descricao':'x'*300})['descricao']),200)

    def resposta(self, dados=None):
        import json
        return io.BytesIO(json.dumps({'output_text':json.dumps(dados or self.dados())}).encode())

    def test_envia_foto_e_schema_com_chave_no_cabecalho(self):
        import json
        with patch.object(leitura,'urlopen',return_value=self.resposta()) as enviar:
            dados=leitura.consultar_gemini(b'foto','chave-secreta','gemini-3.8-flash')
        pedido=enviar.call_args.args[0]
        self.assertNotIn('chave-secreta',pedido.full_url)
        self.assertEqual(pedido.get_header('X-goog-api-key'),'chave-secreta')
        corpo=json.loads(pedido.data)
        self.assertFalse(corpo['store'])
        self.assertEqual(corpo['input'][1]['data'],'Zm90bw==')
        self.assertEqual(corpo['response_format']['mime_type'],'application/json')
        self.assertEqual(dados['valor'],'150.00')
        self.assertEqual(enviar.call_args.kwargs['timeout'],45)

    def test_resposta_em_blocos_texto(self):
        import json
        resposta=io.BytesIO(json.dumps({'outputs':[{'type':'text','text':json.dumps(self.dados())}]}).encode())
        with patch.object(leitura,'urlopen',return_value=resposta):
            self.assertEqual(leitura.consultar_gemini(b'foto','chave','gemini-3.8-flash')['dia'],'2026-10-06')

    def test_resposta_real_em_passos_model_output(self):
        import json
        resposta={'status':'completed','steps':[{'type':'thought','content':[{'type':'text','text':'ignorar'}]}, {'type':'model_output','content':[{'type':'text','text':json.dumps(self.dados())}]}]}
        with patch.object(leitura,'urlopen',return_value=io.BytesIO(json.dumps(resposta).encode())):
            dados=leitura.consultar_gemini(b'foto','chave','gemini-3.5-flash-lite')
        self.assertEqual(dados['valor'],'150.00')
        self.assertEqual(dados['fornecedor'],'Mercado')

    def test_resposta_incompleta_nao_preenche(self):
        import json
        resposta={'status':'failed','output_text':json.dumps(self.dados())}
        with patch.object(leitura,'urlopen',return_value=io.BytesIO(json.dumps(resposta).encode())):
            with self.assertRaises(leitura.ErroLeitura):
                leitura.consultar_gemini(b'foto','chave','gemini-3.5-flash-lite')

    def test_resposta_vazia_invalida_ou_bloqueada(self):
        for resposta in [b'{}',b'nao json',b'{"output_text":"texto livre"}']:
            with patch.object(leitura,'urlopen',return_value=io.BytesIO(resposta)):
                with self.assertRaises(leitura.ErroLeitura):
                    leitura.consultar_gemini(b'foto','chave','gemini-3.8-flash')

    def test_chave_cota_e_conexao_sem_expor_resposta_privada(self):
        from urllib.error import HTTPError, URLError
        for erro in [HTTPError('url',403,'segredo',{},None),HTTPError('url',429,'segredo',{},None),URLError('segredo')]:
            with patch.object(leitura,'urlopen',side_effect=erro):
                with self.assertRaises(leitura.ErroLeitura) as captura:
                    leitura.consultar_gemini(b'foto','chave-secreta','gemini-3.8-flash')
                self.assertNotIn('segredo',str(captura.exception))
                if isinstance(erro,HTTPError) and erro.code==429:
                    self.assertEqual(captura.exception.status,429)

    def test_chave_ausente(self):
        import tempfile
        with tempfile.TemporaryDirectory() as pasta, patch.object(leitura,'__file__',str(Path(pasta)/'leitura.py')), patch.dict(os.environ,{},clear=True):
            with self.assertRaises(leitura.ErroLeitura) as captura:
                leitura.configuracao_gemini()
            self.assertEqual(captura.exception.status,422)

    def test_foto_convertida_e_enviada_ao_gemini(self):
        imagem=Image.new('RGB',(30,40),'white'); arquivo=io.BytesIO(); imagem.save(arquivo,format='PNG'); arquivo.seek(0)
        with patch.object(leitura,'configuracao_gemini',return_value=('chave','gemini-3.8-flash')), patch.object(leitura,'consultar_gemini',return_value=self.dados()) as consultar:
            dados=leitura.ler_comprovante(FileStorage(stream=arquivo,filename='foto.png'))
        self.assertEqual(dados['valor'],'150.00')
        with Image.open(io.BytesIO(consultar.call_args.args[0])) as enviada:
            self.assertEqual(enviada.format,'JPEG')

    def test_pdf_e_arquivo_falso_recusados_antes_do_gemini(self):
        for nome in ['nota.pdf','foto.jpg']:
            with patch.object(leitura,'consultar_gemini') as consultar:
                with self.assertRaises(ValueError):
                    leitura.ler_comprovante(FileStorage(stream=io.BytesIO(b'nao e imagem'),filename=nome))
                consultar.assert_not_called()

class RotaTest(unittest.TestCase):
    def setUp(self):
        arvore=ast.parse((backend/'livro_caixa.py').read_text(encoding='utf-8'))
        funcao=next(no for no in arvore.body if isinstance(no,ast.FunctionDef) and no.name=='ler_dados_comprovante')
        funcao.decorator_list=[]
        self.motor=types.SimpleNamespace(ler_comprovante=Mock(return_value={'valor':'150.00'}))
        self.env=dict(jsonify=lambda dados:dados, usuario_pode_gerenciar_doacoes=Mock(return_value=True),request=types.SimpleNamespace(files={'anexo':'foto'}), app=Mock())
        exec(compile(ast.Module(body=[funcao],type_ignores=[]),'rota','exec'),self.env)

    def executar(self):
        with patch.dict(sys.modules,{'leitura_comprovante':self.motor}):
            return self.env['ler_dados_comprovante']()

    def test_sem_permissao_nao_le_foto(self):
        self.env['usuario_pode_gerenciar_doacoes'].return_value=False
        self.assertEqual(self.executar()[1],403)
        self.motor.ler_comprovante.assert_not_called()

    def test_retorna_sugestoes_sem_acessar_banco(self):
        dados,status=self.executar()
        self.assertEqual(status,200)
        self.assertEqual(dados['dados']['valor'],'150.00')
        self.assertTrue(dados['sucesso'])

    def test_falhas_de_imagem_e_motor(self):
        for erro,status in [(ValueError('foto invalida'),400),(RuntimeError('motor indisponivel'),503),(Exception('falha'),500)]:
            self.motor.ler_comprovante.side_effect=erro
            self.assertEqual(self.executar()[1],status)

if __name__=='__main__':
    unittest.main()
