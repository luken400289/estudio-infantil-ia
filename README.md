# Estúdio Infantil IA — MVP executável

Este projeto inclui uma PWA responsiva, gerador local de roteiros, histórico SQLite, exportação de roteiro TXT e legendas SRT e um renderizador MP4 demonstrativo.

## O que funciona agora

- Interface em português, responsiva e instalável como PWA em hospedagem HTTPS.
- Temas educativos, tema personalizado, faixa etária, estilo e duração de 30/60/90 s.
- Roteiros locais sem chave de API.
- Integração opcional com Gemini para melhorar os diálogos. Consulte preços, disponibilidade e condições antes de usar: https://ai.google.dev/gemini-api/docs/pricing
- Planejamento de cenas, exportação TXT e SRT.
- Histórico local em SQLite.
- Renderizador MP4 real, vertical 1080×1920, com ilustrações originais simples, legendas incorporadas e um tom de áudio de teste, se FFmpeg estiver instalado.

## Limitações importantes

O MP4 do MVP é um **animatic demonstrativo**, não o produto audiovisual final descrito no escopo. Não contém fala sintetizada, música infantil composta nem clipes animados de IA. A imagem das cenas é uma ilustração vetorial simples com Lumi e Tico representados graficamente; ainda não é um modelo de personagem consistente gerado por IA. Não declare esse resultado como episódio final com vozes.

Para o pipeline completo, conecte um provedor de imagens/vídeo, um TTS com vozes pt-BR e uma fonte de música licenciada ou gerada. Cada integração deve ser implementada com a documentação atual do fornecedor, autenticação no servidor, limites de uso, licenças comerciais e tratamento de erros. Não existe garantia de que todo o pipeline seja gratuito ou ilimitado.

## Requisitos

- Node.js 20 ou superior.
- FFmpeg instalado e disponível no PATH para renderização MP4.
- iPhone com Safari para teste móvel. A instalação PWA requer HTTPS quando publicada.

## Instalação local

1. Instale Node.js 20+ e FFmpeg.
2. Extraia o ZIP e entre na pasta `estudio-infantil-ia`.
3. Copie `.env.example` para `.env`.
4. Opcionalmente, crie uma chave no Google AI Studio e configure `GEMINI_API_KEY` no `.env`. Nunca coloque essa chave em `public/`.
5. No terminal, execute:

   ```bash
   npm install
   npm start
   ```

6. Abra `http://localhost:3000` no navegador do computador. O iPhone não acessa o `localhost` do computador; para testar no iPhone, publique em HTTPS ou use uma rede local com configuração segura apropriada.
7. Crie um roteiro. Para testar MP4, clique em “Renderizar MP4 demonstrativo”.

## FFmpeg

Instale pelo gerenciador de pacotes do sistema operacional. Confirme com:

```bash
ffmpeg -version
```

Em hospedagem, confirme que o binário está instalado e que o serviço permite executá-lo. Configure `FFMPEG_PATH` se o executável não estiver no PATH.

## Publicação

O aplicativo precisa de um servidor Node persistente com FFmpeg para renderizar MP4. Um site estático sozinho não executa o back-end. Para experimentar, um serviço Node gratuito pode servir, mas confira os limites e o armazenamento efêmero. A documentação do Render informa que serviços gratuitos podem dormir após inatividade e perder arquivos locais em reinicializações/redeploys: https://render.com/docs/free

Passos gerais:
1. Envie o projeto para um repositório privado ou público sem `.env`.
2. Crie um serviço web Node compatível com execução de FFmpeg.
3. Comando de build: `npm install`.
4. Comando de início: `npm start`.
5. Configure variáveis no painel do provedor: `PORT` (normalmente fornecido), `GEMINI_API_KEY` opcional, `GEMINI_MODEL`, `FFMPEG_PATH`.
6. Garanta armazenamento persistente ou migre SQLite/arquivos para banco e armazenamento de objetos persistentes antes de usar de forma continuada.
7. Ative HTTPS e abra a URL no Safari do iPhone. Use Compartilhar → Adicionar à Tela de Início.

## Segurança e privacidade

- Nunca publique `.env` ou chaves.
- Este MVP não possui login, isolamento entre usuários, cotas por usuário nem proteção contra abuso. Não o exponha como serviço público de produção sem implementar autenticação, rate limiting, validação de entradas e limites de custo.
- Não envie dados pessoais de crianças. Faça revisão humana do conteúdo antes de publicar.
- Confirme os termos de uso e privacidade de cada fornecedor, inclusive uso dos dados para melhoria de modelos.

## Endpoints

- `GET /api/health` — estado básico do servidor e configuração Gemini.
- `GET /api/themes` — temas disponíveis.
- `GET /api/projects` — histórico.
- `POST /api/projects` — gera roteiro. Corpo JSON: `theme`, `customTheme` opcional, `age`, `style`, `duration`, `options`.
- `GET /api/projects/:id` — projeto.
- `POST /api/projects/:id/render` — renderiza o animatic MP4.
- `GET /api/projects/:id/script.txt` — roteiro.
- `GET /api/projects/:id/captions.srt` — legendas SRT.

## Próximas integrações para produção audiovisual

1. Geração de fichas de referência de Lumi/Tico e imagens por cena com referência visual anexada, se o fornecedor suportar.
2. TTS com vozes pt-BR e timestamps por frase; gravar arquivos de áudio por cena.
3. Música original ou licenciada com direitos documentados e mixagem com ducking sob a fala.
4. FFmpeg: montar clipes/imagens, áudio por cena, música, efeitos, legendas e transições; validar duração e sincronização.
5. Fila de trabalhos e progresso real por etapa, com cancelamento, repetição de cena e armazenamento persistente.
6. Revisão de segurança e moderação antes da geração e exportação.
