import os
import logging
import json
from flask import Flask, request, jsonify, send_file
from datetime import datetime
from src.n1ago.config import *
from src.n1ago.knowledge_base import KnowledgeBase
from src.n1ago.conversation import ConversationManager
from src.n1ago.sunshine import SunshineConversationsClient
from src.n1ago.zendesk import ZendeskClient

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicializar Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = SESSION_SECRET

# Inicializar componentes
kb = None
conv_manager = None
sunshine_client = None
zendesk_client = None

try:
    if not all([ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_KEY, OPENAI_API_KEY]):
        logger.warning("Faltam credenciais de configuração - configure as variáveis de ambiente")
        logger.info("N1ago iniciado em modo demo (sem Zendesk e OpenAI)")
    else:
        kb = KnowledgeBase(ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_KEY)
        conv_manager = ConversationManager(OPENAI_API_KEY)
        sunshine_client = SunshineConversationsClient(SUNSHINE_SUBDOMAIN, SUNSHINE_KEY_ID, SUNSHINE_SECRET_KEY)
        zendesk_client = ZendeskClient(ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_KEY)
        
        # Carregar base de conhecimento
        kb.load_articles(ZENDESK_KB_CATEGORY)
        logger.info("N1ago iniciado com sucesso")
except Exception as e:
    logger.error(f"Erro ao inicializar N1ago: {e}")
    logger.info("Continuando em modo demo")

# ===== ROTAS =====

@app.route('/', methods=['GET'])
def serve_frontend():
    """Serve o frontend de teste"""
    return send_file('index.html', mimetype='text/html')

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "N1ago"
    }), 200

@app.route('/webhook/sunshine', methods=['POST'])
def handle_sunshine_webhook():
    """Recebe webhooks do Sunshine Conversations"""
    try:
        if not all([kb, conv_manager, sunshine_client, zendesk_client]):
            return jsonify({"status": "error", "message": "Serviço não configurado. Configure as credenciais."}), 503
        
        payload = request.get_json()
        logger.info(f"Webhook recebido: {json.dumps(payload, indent=2)}")
        
        # Extrair informações do webhook
        app_id = payload.get("app", {}).get("id")
        conversation_id = payload.get("conversation", {}).get("id")
        message = payload.get("message", {})
        
        # Verificar se é mensagem do usuário
        if message.get("author", {}).get("type") != "user":
            return jsonify({"status": "ignored"}), 200
        
        user_message = message.get("content", {}).get("text", "")
        
        if not user_message:
            return jsonify({"status": "ignored"}), 200
        
        logger.info(f"Mensagem do usuário: {user_message}")
        
        # Session ID baseado na conversa
        session_id = f"{app_id}_{conversation_id}"
        
        # Buscar artigos relevantes
        relevant_articles = kb.search(user_message, top_k=3)
        knowledge_context = ""
        if relevant_articles:
            knowledge_context = "Artigos relevantes da base:\n"
            for i, article in enumerate(relevant_articles, 1):
                knowledge_context += f"\n{i}. {article['title']}\n{article['body']}"
        
        # Detectar intenção de escalar
        should_escalate, escalation_score = conv_manager.detect_escalation_intent(user_message)
        
        # Se deve escalar, criar ticket
        if should_escalate or escalation_score > 0.5:
            # Obter resumo da conversa
            conv_summary = conv_manager.get_conversation_summary(session_id)
            
            # Criar ticket no Zendesk
            ticket = zendesk_client.create_ticket(
                subject=f"Escalação N1ago: {user_message[:50]}...",
                description=f"Cliente escalou conversa de crédito.\n\n{conv_summary}",
                tags=["n1ago_escalation", "credit", "escalated"]
            )
            
            if ticket:
                response_text = f"Entendi sua solicitação. Estou conectando você com um agente humano que poderá ajudá-lo melhor. Ticket #: {ticket['id']}"
            else:
                response_text = "Desculpe, tive um problema ao processar seu pedido. Por favor, tente novamente."
        else:
            # Gerar resposta com contexto
            response_text = conv_manager.get_response(
                session_id,
                user_message,
                knowledge_context=knowledge_context
            )
        
        # Enviar resposta via Sunshine
        success = sunshine_client.send_message(app_id, conversation_id, response_text)
        
        if success:
            logger.info(f"Resposta enviada para {conversation_id}")
            return jsonify({"status": "success", "response": response_text}), 200
        else:
            logger.error("Falha ao enviar resposta")
            return jsonify({"status": "error", "message": "Falha ao enviar resposta"}), 500
        
    except Exception as e:
        logger.error(f"Erro ao processar webhook: {e}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    """Endpoint de teste para validar comunicação"""
    kb_size = len(kb.articles) if kb else 0
    return jsonify({
        "status": "ok",
        "knowledge_base_size": kb_size,
        "configured": all([kb, conv_manager, sunshine_client, zendesk_client]),
        "timestamp": datetime.now().isoformat()
    }), 200

@app.route('/debug/conversation/<session_id>', methods=['GET'])
def debug_conversation(session_id):
    """Debug: retorna histórico de uma conversa"""
    if session_id in conv_manager.conversations:
        return jsonify(conv_manager.conversations[session_id]), 200
    else:
        return jsonify({"error": "Conversa não encontrada"}), 404

# ===== MAIN =====

if __name__ == '__main__':
    logger.info(f"Iniciando N1ago em {HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=DEBUG)
