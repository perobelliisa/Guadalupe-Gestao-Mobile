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

## Dashboard

A tela inicial consulta o livro-caixa e os projetos pela API. Entradas e despesas
somam todos os períodos, incluindo pendentes, seguindo a regra do relatório do
backend. O saldo dos lançamentos é a diferença entre esses totais; não representa
somente valores já pagos. Os três últimos lançamentos são ordenados por data e ID.

Os dados são atualizados ao abrir ou retornar à tela e ao puxar para baixo.
O botão de olho oculta os valores, e **Ver todos** abre Movimentações.
Em caso de erro, a tela informa quando estiver mostrando a última consulta.

Testes da dashboard: `node --test tests/dashboard.test.cjs`.
