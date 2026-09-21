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

Nesta etapa estão integrados o login e a identificação do usuário.
Os valores financeiros da tela inicial ainda aguardam integração.
