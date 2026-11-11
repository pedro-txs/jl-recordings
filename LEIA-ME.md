# Gravações — app de áudio para o iPhone

Grava áudio com uma **descrição** (Buscando José, Levando José, Visita na escola…), continua gravando com a **tela bloqueada**, salva no **Google Drive** na pasta que você escolher e **transcreve** automaticamente.

Nome do arquivo: `DESCRIÇÃO dd/mm/aaaa` (data do início da gravação)
Ex.: `BUSCANDO JOSÉ 04/11/2026.m4a` + `BUSCANDO JOSÉ 04/11/2026 - TRANSCRIÇÃO` (Google Docs)

Se gravar duas vezes a mesma descrição no mesmo dia, a segunda vira `BUSCANDO JOSÉ 04/11/2026 (2).m4a`.

---

## O que você precisa (uma vez só)

| Item | Para quê | Custo |
|---|---|---|
| Node.js 20+ no Windows | rodar o projeto | grátis |
| Conta Expo (expo.dev) | compilar o app na nuvem | grátis (cota mensal de builds) |
| Apple Developer Program | instalar no seu iPhone sem Mac | US$ 99/ano |
| Projeto no Google Cloud | login e acesso ao Drive | grátis |
| Chave da OpenAI (opcional) | transcrição | paga por minuto de áudio |

---

## Passo 1 — Instalar as dependências

No PowerShell, dentro de `C:\dev\AudiosJL`:

```powershell
npm install
npm install -g eas-cli
eas login
```

## Passo 2 — Google Cloud (login + Drive)

1. Acesse https://console.cloud.google.com e crie um projeto (ex.: "Gravacoes").
2. **APIs e serviços → Biblioteca** → ative a **Google Drive API**.
3. **APIs e serviços → Tela de permissão OAuth** (Google Auth Platform):
   - Tipo: **Externo**. Nome do app, seu e-mail de suporte.
   - Em **Escopos de dados**, adicione `https://www.googleapis.com/auth/drive`.
   - Em **Público-alvo**, adicione seu Gmail como usuário de teste.
   - **IMPORTANTE:** depois de testar, clique em **Publicar aplicativo** (status "Em produção").
     Em modo "Teste", o Google derruba o login **a cada 7 dias**. Publicado sem verificação funciona
     normal para você — só aparece um aviso "app não verificado" no primeiro login:
     toque em **Avançado → Acessar Gravações (não seguro)**. É seu próprio app, pode seguir.
4. **Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo: **iOS**
   - ID do pacote (bundle ID): `com.txsolucoes.gravacoes`
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) e cole em
   **`google-config.json`**:

```json
{ "iosClientId": "123456-abcdef.apps.googleusercontent.com" }
```

## Passo 3 — Registrar seu iPhone e compilar

```powershell
eas device:create
```
Escolha "Website", abra o link/QR **no iPhone** e instale o perfil (Ajustes → Perfil baixado → Instalar).

No iPhone ative o **Modo de Desenvolvedor**: Ajustes → Privacidade e Segurança → Modo de Desenvolvedor → ligar (o iPhone reinicia).

### Versão para uso no dia a dia (não depende do PC)

```powershell
eas build --profile preview --platform ios
```
O EAS vai pedir login na sua conta Apple Developer e cria certificados sozinho. No fim, ele mostra um link/QR — abra no iPhone e instale. Pronto, o app fica na tela inicial.

### Versão para desenvolver (recarrega ao salvar o código)

```powershell
eas build --profile development --platform ios   # só uma vez, ou quando mudar plugin/dependência nativa
npx expo start --dev-client
```
iPhone e PC na mesma rede Wi-Fi; abra o app "Gravações" (versão dev) e ele conecta no PC.

> Você só precisa gerar build novo quando mudar `app.config.ts`, `google-config.json` ou instalar pacote nativo. Mudanças em telas e lógica aparecem na hora no modo desenvolvimento.

## Passo 4 — Primeiro uso no iPhone

1. Toque em **Conectar** → entre com sua conta Google → aceite o acesso ao Drive.
2. Escolha (ou crie com o **+**) a pasta onde os áudios vão ficar → **Salvar áudios em "…"**.
3. ⚙️ Configurações → **Transcrição** → cole sua chave da OpenAI (https://platform.openai.com/api-keys) → Salvar.
4. Escolha a descrição → toque no botão vermelho → pode bloquear a tela → ao voltar, toque para parar.

---

## Como funciona

- **Gravação com tela bloqueada:** ativado pelo modo de áudio em segundo plano do iOS (`enableBackgroundRecording`). Aparece o indicador laranja/vermelho de microfone no topo do iPhone enquanto grava — isso é do próprio iOS.
- **Sem internet no carro?** O áudio fica salvo no iPhone e entra na **fila**. É enviado sozinho quando o app abrir de novo (ou a cada minuto com o app aberto). Toque no item para "Tentar de novo".
- **Envio:** upload "resumable" do Drive em sessão de segundo plano do iOS.
- **Transcrição:** OpenAI Whisper, em português. Vira um Google Docs na mesma pasta. Limite de 25 MB por áudio (≈ 1h30 na qualidade de voz do app); acima disso o áudio sobe, mas não é transcrito.
- **Espaço no iPhone:** depois que o áudio sobe e a transcrição termina, a cópia local é apagada.
- **Descrições:** edite em ⚙️ → Descrições do áudio (adicionar/remover).

## Limitações honestas

- **Ligação telefônica** interrompe qualquer gravação no iOS. O app mostra "Gravação pausada — toque para continuar". O trecho da ligação não é gravado.
- **Fechar o app à força** (arrastar para cima no seletor de apps) durante a gravação encerra a gravação. Bloquear a tela ou trocar de app **não** encerra.
- **Barra "/" no nome:** o Drive aceita `04/11/2026` no nome, mas se você **baixar** o arquivo no Windows, o Drive troca a barra por `_` (o Windows não permite "/" em nome de arquivo).
- A chave da OpenAI fica no Keychain do iPhone. Como é um app só seu, tudo bem; não distribua o app com sua chave.

## Estrutura

```
App.tsx                      tela principal + controle da gravação
app.config.ts                configuração do Expo (permissões, tela bloqueada, login Google)
google-config.json           ← cole aqui o ID do cliente iOS
eas.json                     perfis de build (development / preview / production)
src/drive.ts                 login Google, listar/criar pastas, upload de áudio e transcrição
src/transcribe.ts            chamada à OpenAI (Whisper)
src/queue.ts                 fila de envio (funciona offline)
src/naming.ts                "DESCRIÇÃO dd/mm/aaaa"
src/storage.ts               configurações, histórico, chave no Keychain
src/components/              telas e componentes visuais
```
