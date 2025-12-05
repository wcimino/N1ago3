# N1ago - Agente de Atendimento sobre Crédito

## Visão Geral

N1ago é um agente conversacional inteligente integrado ao Zendesk Sunshine Conversations para atendimento automatizado sobre crédito. Ele:

- **Recebe mensagens** via webhooks do Sunshine Conversations
- **Armazena todas as conversas** no banco de dados PostgreSQL
- **Busca conhecimento** na base de artigos do Zendesk (categoria 360004211092)
- **Gera respostas** usando OpenAI GPT-3.5-turbo
- **Detecta necessidade de escalar** para agente humano
- **Cria tickets** no Zendesk quando necessário

## Arquitetura

```
Zendesk Sunshine Conversations (Webhook)
    ↓
Flask API (app.py)
    ├→ WebhookRawLog (log imediato de todas as chamadas)
    ├→ PostgreSQL (armazena conversas e mensagens)
    ├→ KnowledgeBase (busca Zendesk)
    ├→ ConversationManager (GPT-3.5)
    ├→ SunshineConversationsClient (resposta ao usuário)
    └→ ZendeskClient (criar ticket)
```

## Banco de Dados

O sistema usa PostgreSQL para armazenar todas as interações:

### Tabelas

1. **webhook_raw_logs** - Log bruto de TODAS as chamadas do webhook
   - Armazena headers, payload, raw_body
   - Status de processamento (pending, success, error)
   - Mensagem de erro quando aplicável

2. **conversations** - Conversas do Zendesk
   - ID da conversa e app do Zendesk
   - Dados do usuário
   - Status (active, closed)

3. **messages** - Mensagens individuais
   - Autor (user, agent, bot)
   - Conteúdo (texto ou payload)
   - Timestamps do Zendesk e local

## Estrutura do Projeto

```
.
├── app.py                          # API Flask principal
├── models.py                       # Modelos SQLAlchemy (banco de dados)
├── requirements.txt                # Dependências Python
├── .env.example                    # Exemplo de variáveis de ambiente
├── index.html                      # Frontend de teste
└── src/n1ago/
    ├── __init__.py
    ├── config.py                   # Configurações (credenciais, parâmetros)
    ├── knowledge_base.py           # RAG - busca na base Zendesk
    ├── conversation.py             # Motor conversacional com OpenAI
    ├── sunshine.py                 # Cliente Sunshine Conversations
    └── zendesk.py                  # Cliente Zendesk API
```

## Configuração

### 1. Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha com suas credenciais:

```bash
cp .env.example .env
```

**Credenciais Necessárias:**

- `OPENAI_API_KEY`: Obter em https://platform.openai.com/api-keys
- `ZENDESK_SUBDOMAIN`: Seu subdomínio Zendesk (ex: movilepay)
- `ZENDESK_EMAIL`: Email do usuário Zendesk
- `ZENDESK_API_KEY`: API Token do Zendesk
- `SUNSHINE_KEY_ID` e `SUNSHINE_SECRET_KEY`: Credenciais da integração Sunshine Conversations

### 2. Configurar Zendesk

#### Criar Integração Sunshine Conversations

1. Vá para Admin Center → Apps and integrations → Integrations → Conversations integrations
2. Clique em "Create integration"
3. Configure:
   - **Target URL**: `https://seu-dominio.replit.dev/webhook/sunshine`
   - **Triggers**: Selecione `message:appUser`
   - **Webhook version**: v2
4. Salve e anote:
   - **Key ID** → `SUNSHINE_KEY_ID`
   - **Secret Key** → `SUNSHINE_SECRET_KEY`

#### Criar API Key Zendesk

1. Admin Center → Apps and integrations → API and webhooks → API tokens
2. Crie um novo token com permissão para:
   - Ler artigos da Help Center
   - Criar tickets

### 3. Iniciar o Servidor

```bash
python app.py
```

Servidor roda em: http://0.0.0.0:5000

## Endpoints

### Webhooks

#### `/webhook/zendesk` (POST)
Endpoint principal para receber eventos do Zendesk Sunshine Conversations.
- Registra TODAS as chamadas no banco antes de processar
- Valida assinatura HMAC se `ZENDESK_WEBHOOK_SECRET` estiver configurado
- Processa eventos: `conversation:message`, `conversation:create`

#### `/webhook/sunshine` (POST)
Endpoint legado para compatibilidade com integrações existentes.

### APIs de Consulta

#### `/api/webhook-logs` (GET)
Lista logs de webhooks recebidos
- Parâmetros: `status` (filtrar por status), `limit`, `offset`
```json
{
  "total": 100,
  "logs": [{"id": 1, "processing_status": "success", ...}]
}
```

#### `/api/webhook-logs/<id>` (GET)
Detalhes completos de um log específico (headers, payload, raw_body)

#### `/api/webhook-logs/stats` (GET)
Estatísticas dos logs por status

#### `/api/conversations` (GET)
Lista todas as conversas armazenadas

#### `/api/conversations/<zendesk_id>/messages` (GET)
Mensagens de uma conversa específica

### Outros

#### `/health` (GET)
Health check do servidor

#### `/test` (GET)
Verifica configuração do servidor

#### `/debug/conversation/<session_id>` (GET)
Ver histórico de uma conversa (debug)

## Fluxo de Atendimento

1. **Cliente envia mensagem** via Sunshine Conversations
2. **N1ago recebe webhook** em `/webhook/sunshine`
3. **Busca na base de conhecimento** artigos relevantes sobre crédito
4. **Detecta se deve escalar** (frustração, solicitação direta, não consegue resolver)
5. **Se escalar**: Cria ticket no Zendesk e informa cliente
6. **Se não escalar**: Gera resposta com GPT-3.5 + contexto da base
7. **Envia resposta** ao cliente via Sunshine Conversations

## Detectando Necessidade de Escalar

N1ago escala automaticamente se:

- Usuário menciona: "falar com agente", "atendente", "supervisor"
- Detecção de frustração (análise heurística)
- Não encontra artigos relevantes (confiança < 10%)
- Solicitação explícita de escalar

## Próximos Passos

### MVP Completo (Prioridades)
- [ ] Testar integração real com Sunshine Conversations
- [ ] Validar webhook signature do Zendesk
- [ ] Melhorar detecção de escalação com análise de sentimento
- [ ] Cachear base de conhecimento periodicamente
- [ ] Adicionar logs mais detalhados

### Fase 2 (Melhorias)
- [ ] Dashboard com métricas de atendimento
- [ ] Fine-tuning do GPT-3.5 com histórico de conversas
- [ ] Respostas ricas (botões, carrossel de opções)
- [ ] Integração com sistemas internos (saldo, faturas)
- [ ] Analytics e feedback de satisfação

## Troubleshooting

### "Serviço não configurado. Configure as credenciais."
- Preencha o arquivo `.env` com todas as credenciais
- Reinicie o servidor: `python app.py`

### Webhook não recebe eventos
- Confirme URL do webhook em Zendesk (Admin Center → Integrations)
- Verifique se é HTTPS e acessível publicamente
- Teste POST em `/health` para confirmar conectividade

### Respostas vazias ou genéricas
- Confirme que `OPENAI_API_KEY` é válido
- Verifique que `ZENDESK_KB_CATEGORY` tem artigos (GET `/test`)
- Considere ajustar `FRUSTRATION_THRESHOLD` em config.py

## Secrets & Segurança

- **Nunca commit `.env`** com credenciais reais
- Use Replit Secrets para produção
- API Keys do Zendesk e OpenAI são altamente sensíveis
- Valide sempre webhook signatures em produção

## Stack

- **Backend**: Python 3.11, Flask
- **IA**: OpenAI GPT-3.5-turbo, TF-IDF para RAG
- **APIs**: Zendesk, Sunshine Conversations
- **Frontend (teste)**: HTML/CSS/JS vanilla

## Observações Técnicas

- **Contexto de conversa**: Mantém até 10 mensagens anteriores
- **Timeout de escalar**: 600 segundos (10 minutos)
- **Limiar de frustração**: 0.7 (escala se score > 0.7)
- **Limiar de similaridade**: 0.1 (busca artigos com score > 0.1)

---

**Última atualização**: 2025-12-05
**Versão**: MVP 0.2

## Changelog

### v0.2 (2025-12-05)
- Adicionado banco de dados PostgreSQL para armazenar conversas
- Novo endpoint `/webhook/zendesk` com log imediato de todas as chamadas
- Tabela `webhook_raw_logs` para auditoria completa
- APIs REST para consultar logs, conversas e mensagens
- Validação de assinatura HMAC para segurança do webhook
