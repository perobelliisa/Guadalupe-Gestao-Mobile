# Guadalupe-Gestao-Mobile
Aplicativo mobile da Gestão Guadalupe

## Desenvolvimento

O projeto utiliza Expo SDK 57, React Native 0.86 e React 19.2.3.
Use Node.js 22.13 ou superior e Expo Go compatível com o SDK 57.

```bash
npm ci
npx expo start --clear
```

Após atualizar o SDK, encerre o servidor Metro anterior e reabra o aplicativo
pelo novo QR code. Se usar um APK próprio, gere e instale uma nova versão nativa.

## Verificação das dependências

```bash
npx expo install --check
npx expo-doctor
```

Ao atualizar o Expo, execute também `npx expo install --fix` para alinhar o React
Native e os módulos nativos. Misturar versões de SDKs diferentes pode causar
erros de inicialização como `PlatformConstants could not be found`.

Referência: [documentação do Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).

## API local e login

A API Flask está no projeto `GuadalupeGestao-Back` e utiliza a porta 5000.
Mantenha a API executando no PyCharm e o celular na mesma rede do computador.
O endereço fica em `src/services/api.js`, na constante `API_URL`.
Se o IP do computador mudar, consulte `ipconfig` e atualize essa constante.

O login envia `email` e `senha` para `POST /login`. Os dados do usuário ficam
no AsyncStorage e o token fica no armazenamento seguro do celular, pelo
`expo-secure-store`. A senha não é salva.

Após entrar uma vez, é possível fechar o aplicativo e usar a biometria na
próxima abertura. Ela desbloqueia a sessão e consulta `GET /minha-conta` para
confirmar sua validade. É necessário ter conexão com a API.
Ao tocar em **Sair**, a sessão e a liberação da biometria são apagadas;
o próximo acesso deve ser feito com e-mail e senha.

## Movimentações

Acesse **Movimentos** pelo menu inferior. A tela consulta `GET /livro-caixa`,
com busca por descrição, categoria ou projeto e filtros de receitas e despesas.
Puxe a lista para baixo para atualizar. A seta alterna a ordem das datas.

O botão **+** abre o cadastro. Receitas são enviadas para `POST /entradas` e
despesas para `POST /despesas`; o backend grava na tabela `LIVRO_CAIXA`.
Categorias e projetos vêm de `GET /categorias` e `GET /projetos`.
Todas essas chamadas utilizam o token do login. O backend permite acesso aos
tipos de usuário 0 e 1.

As formas de pagamento seguem as descrições do banco: 0 Pix, 1 Crédito,
2 Débito, 3 Boleto, 4 Parcelamento e 5 Dinheiro. Os campos correspondem aos
formulários `NovaEntrada.jsx` e `NovaDespesa.jsx` do sistema web:

- Entrada: descrição, valor, data, categoria existente ou nova, projeto,
  fonte do recurso existente ou nova, meio de recebimento, anexo e observação.
- Despesa: descrição, valor, data, categoria existente ou nova, origem do
  pagamento existente ou nova, fornecedor, projeto, forma de pagamento,
  status, recorrência, datas de início e fim, anexo e observação.

As despesas aceitam recorrência a cada 15 dias, a cada 30 dias, diária ou
semanal, além de não recorrente. Datas seguem as mesmas regras do web.
As origens sugeridas vêm dos lançamentos existentes. O campo de vencimento
foi removido porque não aparece no formulário web de nova despesa.

Anexos PDF, JPG e PNG são selecionados com `expo-document-picker` e enviados
como `multipart/form-data`. A correção em `GuadalupeGestao-Back/function.py`
salva o arquivo em `arquivos/movimentacoes` e retorna seu caminho no livro-caixa.
Reinicie a API para carregar a alteração. Em um APK próprio, gere uma nova
versão nativa após adicionar o seletor de documentos.

Após salvar, a lista é
consultada novamente. Falhas de conexão são exibidas sem simular um cadastro.

Testes do serviço: `node --test tests/movimentacoes.test.cjs`.

## Comprovantes

A aba **Comprovantes** consulta `GET /livro-caixa` e exibe todas as transações.
A pesquisa filtra pela descrição ou pelo tipo (entrada/receita ou despesa),
sem diferenciar maiúsculas e acentos. Transações sem anexo exibem o botão
**Anexar comprovante**, que permite enviar PDF, JPG ou PNG pela rota
`POST /livro-caixa/<id>/anexo`. Após a confirmação da API, o cartão e o
contador de comprovantes enviados são atualizados.
Toque no arquivo para abri-lo. Puxe a lista para atualizar; ela também é
consultada ao voltar à tela. Os anexos são enviados no cadastro de movimentações.

Validação: `node --test --test-isolation=none tests/*.test.cjs` e
`python tests/comprovantes_backend.py` (requer o backend na pasta vizinha).

## Mais / Configurações

A aba **Mais** consulta `GET /minha-conta` e permite editar nome, e-mail,
perfil de acesso e status. **Salvar alterações** envia os quatro campos
em formulário para `PUT /minha-conta`, usando o token do login.
O nome e e-mail locais são atualizados após a confirmação da API.
Alterar o perfil para financeiro/voluntário ou desativar a conta encerra a
sessão, pois o app permite acesso a administradores ativos.
**Sair do aplicativo** limpa os dados de sessão e biometria e volta ao login.

## Dashboard

A tela inicial consulta o livro-caixa e os projetos pela API. Entradas e despesas
somam todos os períodos, incluindo pendentes, seguindo a regra do relatório do
backend. O saldo dos lançamentos é a diferença entre esses totais; não representa
somente valores já pagos. Os três últimos lançamentos são ordenados por data e ID.

Os dados são atualizados ao abrir ou retornar à tela e ao puxar para baixo.
O botão de olho oculta os valores, e **Ver todos** abre Movimentações.
Em caso de erro, a tela informa quando estiver mostrando a última consulta.

Testes da dashboard: `node --test tests/dashboard.test.cjs`.


## Notificações de despesas

O sininho ao lado de Sair abre uma lista de despesas vencidas ou com vencimento
nos próximos 13 dias, seguindo as faixas Alta e Média do web. Mostra um contador,
a descrição, a data e mensagens como vence hoje, amanhã ou em determinada
quantidade de dias. Contas pagas saem da lista na próxima consulta à API.

A lista consulta GET /pendencias com o token do usuário, ao entrar ou voltar à
Home, retornar ao app, abrir o painel e a cada minuto enquanto o app está ativo.
O painel tem atualização manual e informa falhas sem apagar a última consulta.
São avisos dentro do aplicativo, sem solicitar permissão de notificações do celular.


## Editar e pagar no mobile

Toque na linha em Movimentos para abrir o pop-up de edição, como no web.
Os campos são preenchidos com os dados atuais da API. Salvar alterações usa
PUT /livro-caixa/<id>; o tipo fica fixo e o comprovante existente é mantido.
Cancelar fecha o editor sem gravar. Gerencie arquivos na aba Comprovantes.

Dentro do editor de despesa, Marcar como pago abre uma confirmação com
descrição, valor e vencimento, Cancelar e Confirmar pagamento. Salve edições
pendentes antes de usar o pagamento. Despesas simples recebem status Pago.
Nas recorrentes, apenas a ocorrência exibida é quitada pela mesma rota do web,
POST /pendencias/despesa/<id>/pagar; as futuras continuam em aberto.
O sininho usa a mesma janela de confirmação para o vencimento selecionado.

Após sucesso da API, o editor fecha e a lista é atualizada. Falhas aparecem
na janela, sem fechar nem confirmar pagamento. Envios simultâneos são bloqueados.

### Despesa a partir do comprovante

Na aba Despesa do cadastro, use **Tirar foto do comprovante**. Os dados
reconhecidos preenchem o formulário para revisão. Na lista de Movimentações,
o filtro Despesas também oferece **Cadastrar despesa pela foto**, que abre
o cadastro e inicia a câmera. A leitura sugere categoria e origem usando as opções
cadastradas como referência. Opções existentes são selecionadas; sugestões novas
preenchem os campos de cadastro e só são gravadas ao salvar a despesa. A origem
precisa estar explícita na foto (por exemplo, o banco do pagador); dados ambíguos
ficam vazios para preenchimento manual. Somente Salvar cadastra a despesa e envia o comprovante.
Em débito, a leitura considera o banco emissor ou cartão identificado como origem,
e sugere Pago quando houver confirmação de aprovação ou autorização da venda.
Sem confirmação, o status permanece Não pago para revisão. O app avisa quando a
resposta vier de um backend antigo, que precisa ser reiniciado após a atualização.

A API envia a foto ao Gemini para extrair os dados. O aplicativo não recebe
a chave. A resposta é validada antes de preencher o formulário, e a despesa
só é cadastrada ao tocar em Salvar.

No projeto `GuadalupeGestao-Back`, abra `gemini.local.json`, informe sua chave
no campo `api_key` e reinicie a API. Esse arquivo é ignorado pelo Git.
Também é possível configurar `GEMINI_API_KEY` e `GEMINI_MODEL` como variáveis
de ambiente do servidor. Modelo padrão: `gemini-3.5-flash-lite`. A integração usa
a API REST do Gemini e Pillow, sem depender do leitor do Windows.

Crie a chave no [Google AI Studio](https://aistudio.google.com/apikey).
A chave precisa de acesso ao modelo configurado e de cota disponível.
Não coloque a chave no aplicativo nem em variáveis `EXPO_PUBLIC_*`.
PDF continua disponível para anexar, mas a leitura aceita fotos JPG/PNG.

Verificação: `python tests/leitura_comprovante_backend.py` valida o contrato
com o Gemini com respostas simuladas, sem usar uma chave ou acessar o banco.

### Chat da Lupe

No início, toque em **Converse com a Lupe**, ou abra **Mais → Lupe**.
A assistente conversa em português e orienta sobre os recursos do aplicativo.
A tela inclui sugestões de perguntas, indicação de resposta em andamento e
nova conversa. Se o envio falhar, a mensagem volta ao campo para tentar novamente.

O aplicativo envia `POST /lupe/chat` com autenticação e as últimas dez trocas
da conversa (até 40 mil caracteres de contexto). Cada mensagem do usuário aceita
até 2.000 caracteres. A conversa fica na memória da tela e não é salva no celular
nem no banco. Voltar ou iniciar nova conversa limpa esse contexto.

O módulo `lupe.py` do backend usa a mesma chave e modelo configurados para o
Gemini. `LUPE_MODEL` permite escolher outro modelo apenas para o chat. Reinicie
o backend depois de registrar a nova rota em `main.py`. A Lupe recebe somente
as mensagens enviadas no chat; não consulta dados financeiros nem altera registros.

Verificação: `node --test tests/lupe.test.cjs` e `python -B tests/lupe_backend.py`.
Os testes usam respostas simuladas e não acessam a IA nem o banco.
