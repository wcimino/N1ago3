# N1ago - Agente de Atendimento sobre Crédito

## Visão Geral

N1ago é um agente conversacional inteligente integrado ao Zendesk Sunshine Conversations para atendimento automatizado sobre crédito. Ele:

- **Recebe mensagens** via webhooks do Sunshine Conversations
- **Busca conhecimento** na base de artigos do Zendesk (categoria 360004211092)
- **Gera respostas** usando OpenAI GPT-3.5-turbo
- **Detecta necessidade de escalar** para agente humano
- **Cria tickets** no Zendesk quando necessário

## Arquitetura

```
Sunshine Conversations (Webhook)
    ↓
Flask API (app.py)
    ├→ KnowledgeBase (busca Zendesk)
    ├→ ConversationManager (GPT-3.5)
    └→ SunshineConversationsClient (resposta ao usuário)
    └→ ZendeskClient (criar ticket)
```

## Estrutura do Projeto

```
.
├── app.py                          # API Flask principal
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

### `/health` (GET)
Health check do servidor
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T22:30:51",
  "service": "N1ago"
}
```

### `/webhook/sunshine` (POST)
Recebe eventos do Sunshine Conversations e responde
```json
{
  "app": {"id": "app_123"},
  "conversation": {"id": "conv_456"},
  "message": {
    "author": {"type": "user"},
    "content": {"type": "text", "text": "Como funciona crédito?"}
  }
}
```

### `/test` (GET)
Verifica configuração do servidor
```json
{
  "status": "ok",
  "knowledge_base_size": 42,
  "configured": true,
  "timestamp": "2025-12-04T22:30:51"
}
```

### `/debug/conversation/<session_id>` (GET)
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

**Última atualização**: 2025-12-04
**Versão**: MVP 0.1
