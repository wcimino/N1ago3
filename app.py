import os
import logging
import json
import hmac
import hashlib
from flask import Flask, request, jsonify, send_file
from datetime import datetime
from src.n1ago.config import *
from src.n1ago.knowledge_base import KnowledgeBase
from src.n1ago.conversation import ConversationManager
from src.n1ago.sunshine import SunshineConversationsClient
from src.n1ago.zendesk import ZendeskClient
from models import db, WebhookRawLog, Conversation, Message

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "a secret key"
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

db.init_app(app)

with app.app_context():
    db.create_all()
    logger.info("Tabelas do banco de dados criadas/verificadas")

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

def verify_webhook_signature(payload_body: bytes, signature: str, secret: str) -> tuple[bool, str]:
    """Verifica a assinatura HMAC do webhook do Zendesk
    
    Returns:
        tuple: (is_valid, error_message)
        - Se não há segredo configurado: (True, None) - validação desabilitada
        - Se há segredo mas não há assinatura: (False, "Assinatura ausente")
        - Se assinatura inválida: (False, "Assinatura inválida")
        - Se assinatura válida: (True, None)
    """
    if not secret:
        return True, None
    
    if not signature:
        return False, "Assinatura ausente - header X-Smooch-Signature ou X-Zendesk-Webhook-Signature não encontrado"
    
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload_body,
        hashlib.sha256
    ).hexdigest()
    
    if hmac.compare_digest(f"sha256={expected_signature}", signature):
        return True, None
    
    return False, "Assinatura inválida"


def log_webhook_raw(source_ip: str, headers: dict, payload: dict, raw_body: str) -> WebhookRawLog:
    """Registra imediatamente a chamada do webhook no banco"""
    log_entry = WebhookRawLog(
        received_at=datetime.utcnow(),
        source_ip=source_ip,
        headers=headers,
        payload=payload,
        raw_body=raw_body,
        processing_status='pending'
    )
    db.session.add(log_entry)
    db.session.commit()
    return log_entry


def update_webhook_log_status(log_entry: WebhookRawLog, status: str, error_message: str = None):
    """Atualiza o status de processamento do log"""
    log_entry.processing_status = status
    log_entry.processed_at = datetime.utcnow()
    if error_message:
        log_entry.error_message = error_message
    db.session.commit()


def get_or_create_conversation(zendesk_conversation_id: str, zendesk_app_id: str = None, user_data: dict = None) -> Conversation:
    """Busca ou cria uma conversa no banco"""
    conversation = Conversation.query.filter_by(zendesk_conversation_id=zendesk_conversation_id).first()
    
    if not conversation:
        conversation = Conversation(
            zendesk_conversation_id=zendesk_conversation_id,
            zendesk_app_id=zendesk_app_id,
            user_id=user_data.get('id') if user_data else None,
            user_external_id=user_data.get('externalId') if user_data else None,
            metadata_json=user_data
        )
        db.session.add(conversation)
        db.session.commit()
    else:
        conversation.updated_at = datetime.utcnow()
        db.session.commit()
    
    return conversation


def save_message(conversation: Conversation, message_data: dict, webhook_log_id: int = None) -> Message:
    """Salva uma mensagem no banco"""
    author = message_data.get('author', {})
    content = message_data.get('content', {})
    
    zendesk_timestamp = None
    if message_data.get('received'):
        try:
            zendesk_timestamp = datetime.fromisoformat(message_data['received'].replace('Z', '+00:00'))
        except:
            pass
    
    message = Message(
        conversation_id=conversation.id,
        zendesk_message_id=message_data.get('id'),
        author_type=author.get('type', 'unknown'),
        author_id=author.get('userId') or author.get('appId'),
        author_name=author.get('displayName'),
        content_type=content.get('type', 'text'),
        content_text=content.get('text'),
        content_payload=content if content.get('type') != 'text' else None,
        zendesk_timestamp=zendesk_timestamp,
        metadata_json=message_data.get('metadata'),
        webhook_log_id=webhook_log_id
    )
    db.session.add(message)
    db.session.commit()
    return message


@app.route('/webhook/zendesk', methods=['POST'])
def handle_zendesk_conversations_webhook():
    """Recebe webhooks do Zendesk Sunshine Conversations - com log de todas as chamadas"""
    raw_body = request.get_data(as_text=True)
    source_ip = request.remote_addr
    headers_dict = dict(request.headers)
    
    try:
        payload = request.get_json() or {}
    except:
        payload = {}
    
    log_entry = log_webhook_raw(source_ip, headers_dict, payload, raw_body)
    logger.info(f"Webhook registrado - Log ID: {log_entry.id}")
    
    try:
        webhook_secret = os.environ.get('ZENDESK_WEBHOOK_SECRET', '')
        signature = request.headers.get('X-Smooch-Signature', '') or request.headers.get('X-Zendesk-Webhook-Signature', '')
        
        is_valid, error_msg = verify_webhook_signature(request.get_data(), signature, webhook_secret)
        if not is_valid:
            update_webhook_log_status(log_entry, 'error', error_msg)
            return jsonify({"status": "error", "message": error_msg}), 401
        
        events = payload.get('events', [])
        
        if not events:
            update_webhook_log_status(log_entry, 'success', 'Nenhum evento para processar')
            return jsonify({"status": "ok", "message": "No events"}), 200
        
        processed_count = 0
        
        for event in events:
            event_type = event.get('type')
            event_payload = event.get('payload', {})
            
            if event_type in ['conversation:message', 'message']:
                conversation_data = event_payload.get('conversation', {}) or payload.get('conversation', {})
                zendesk_conversation_id = conversation_data.get('id')
                zendesk_app_id = payload.get('app', {}).get('id')
                
                if zendesk_conversation_id:
                    user_data = event_payload.get('user') or payload.get('user')
                    conversation = get_or_create_conversation(zendesk_conversation_id, zendesk_app_id, user_data)
                    
                    messages = event_payload.get('messages', [])
                    if not messages and event_payload.get('message'):
                        messages = [event_payload.get('message')]
                    
                    for msg in messages:
                        save_message(conversation, msg, log_entry.id)
                        processed_count += 1
                        logger.info(f"Mensagem salva - Conversa: {zendesk_conversation_id}, Autor: {msg.get('author', {}).get('type')}")
            
            elif event_type == 'conversation:create':
                conversation_data = event_payload.get('conversation', {})
                zendesk_conversation_id = conversation_data.get('id')
                zendesk_app_id = payload.get('app', {}).get('id')
                
                if zendesk_conversation_id:
                    user_data = event_payload.get('user')
                    get_or_create_conversation(zendesk_conversation_id, zendesk_app_id, user_data)
                    processed_count += 1
                    logger.info(f"Conversa criada: {zendesk_conversation_id}")
        
        update_webhook_log_status(log_entry, 'success')
        return jsonify({
            "status": "success",
            "log_id": log_entry.id,
            "events_processed": processed_count
        }), 200
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Erro ao processar webhook: {error_msg}", exc_info=True)
        update_webhook_log_status(log_entry, 'error', error_msg)
        return jsonify({
            "status": "error",
            "message": error_msg,
            "log_id": log_entry.id
        }), 500


@app.route('/webhook/sunshine', methods=['POST'])
def handle_sunshine_webhook():
    """Recebe webhooks do Sunshine Conversations (endpoint legado)"""
    raw_body = request.get_data(as_text=True)
    source_ip = request.remote_addr
    headers_dict = dict(request.headers)
    
    try:
        payload = request.get_json() or {}
    except:
        payload = {}
    
    log_entry = log_webhook_raw(source_ip, headers_dict, payload, raw_body)
    logger.info(f"Webhook Sunshine registrado - Log ID: {log_entry.id}")
    
    try:
        if not all([kb, conv_manager, sunshine_client, zendesk_client]):
            update_webhook_log_status(log_entry, 'error', 'Serviço não configurado')
            return jsonify({"status": "error", "message": "Serviço não configurado. Configure as credenciais."}), 503
        
        app_id = payload.get("app", {}).get("id")
        conversation_id = payload.get("conversation", {}).get("id")
        message = payload.get("message", {})
        
        if conversation_id:
            user_data = payload.get("appUser") or payload.get("user")
            conversation = get_or_create_conversation(conversation_id, app_id, user_data)
            if message:
                save_message(conversation, message, log_entry.id)
        
        if message.get("author", {}).get("type") != "user":
            update_webhook_log_status(log_entry, 'success', 'Mensagem não é do usuário')
            return jsonify({"status": "ignored"}), 200
        
        user_message = message.get("content", {}).get("text", "")
        
        if not user_message:
            update_webhook_log_status(log_entry, 'success', 'Mensagem vazia')
            return jsonify({"status": "ignored"}), 200
        
        logger.info(f"Mensagem do usuário: {user_message}")
        
        session_id = f"{app_id}_{conversation_id}"
        
        relevant_articles = kb.search(user_message, top_k=3)
        knowledge_context = ""
        if relevant_articles:
            knowledge_context = "Artigos relevantes da base:\n"
            for i, article in enumerate(relevant_articles, 1):
                knowledge_context += f"\n{i}. {article['title']}\n{article['body']}"
        
        should_escalate, escalation_score = conv_manager.detect_escalation_intent(user_message)
        
        if should_escalate or escalation_score > 0.5:
            conv_summary = conv_manager.get_conversation_summary(session_id)
            
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
            response_text = conv_manager.get_response(
                session_id,
                user_message,
                knowledge_context=knowledge_context
            )
        
        success = sunshine_client.send_message(app_id, conversation_id, response_text)
        
        if success:
            logger.info(f"Resposta enviada para {conversation_id}")
            update_webhook_log_status(log_entry, 'success')
            return jsonify({"status": "success", "response": response_text, "log_id": log_entry.id}), 200
        else:
            logger.error("Falha ao enviar resposta")
            update_webhook_log_status(log_entry, 'error', 'Falha ao enviar resposta')
            return jsonify({"status": "error", "message": "Falha ao enviar resposta", "log_id": log_entry.id}), 500
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Erro ao processar webhook: {error_msg}", exc_info=True)
        update_webhook_log_status(log_entry, 'error', error_msg)
        return jsonify({"status": "error", "message": error_msg, "log_id": log_entry.id}), 500

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
    if conv_manager and session_id in conv_manager.conversations:
        return jsonify(conv_manager.conversations[session_id]), 200
    else:
        return jsonify({"error": "Conversa não encontrada"}), 404


@app.route('/api/webhook-logs', methods=['GET'])
def list_webhook_logs():
    """Lista os logs de webhook com filtros opcionais"""
    status = request.args.get('status')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    query = WebhookRawLog.query.order_by(WebhookRawLog.received_at.desc())
    
    if status:
        query = query.filter_by(processing_status=status)
    
    logs = query.offset(offset).limit(limit).all()
    total = query.count()
    
    return jsonify({
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [{
            "id": log.id,
            "received_at": log.received_at.isoformat() if log.received_at else None,
            "source_ip": log.source_ip,
            "processing_status": log.processing_status,
            "error_message": log.error_message,
            "processed_at": log.processed_at.isoformat() if log.processed_at else None
        } for log in logs]
    }), 200


@app.route('/api/webhook-logs/<int:log_id>', methods=['GET'])
def get_webhook_log(log_id):
    """Obtém detalhes completos de um log de webhook"""
    log = WebhookRawLog.query.get_or_404(log_id)
    
    return jsonify({
        "id": log.id,
        "received_at": log.received_at.isoformat() if log.received_at else None,
        "source_ip": log.source_ip,
        "headers": log.headers,
        "payload": log.payload,
        "raw_body": log.raw_body,
        "processing_status": log.processing_status,
        "error_message": log.error_message,
        "processed_at": log.processed_at.isoformat() if log.processed_at else None
    }), 200


@app.route('/api/conversations', methods=['GET'])
def list_conversations():
    """Lista todas as conversas"""
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    conversations = Conversation.query.order_by(Conversation.updated_at.desc()).offset(offset).limit(limit).all()
    total = Conversation.query.count()
    
    return jsonify({
        "total": total,
        "offset": offset,
        "limit": limit,
        "conversations": [{
            "id": conv.id,
            "zendesk_conversation_id": conv.zendesk_conversation_id,
            "zendesk_app_id": conv.zendesk_app_id,
            "user_id": conv.user_id,
            "status": conv.status,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            "message_count": conv.messages.count()
        } for conv in conversations]
    }), 200


@app.route('/api/conversations/<zendesk_id>/messages', methods=['GET'])
def get_conversation_messages(zendesk_id):
    """Obtém todas as mensagens de uma conversa"""
    conversation = Conversation.query.filter_by(zendesk_conversation_id=zendesk_id).first_or_404()
    
    messages = conversation.messages.order_by(Message.received_at.asc()).all()
    
    return jsonify({
        "conversation_id": conversation.zendesk_conversation_id,
        "messages": [{
            "id": msg.id,
            "author_type": msg.author_type,
            "author_name": msg.author_name,
            "content_type": msg.content_type,
            "content_text": msg.content_text,
            "received_at": msg.received_at.isoformat() if msg.received_at else None,
            "zendesk_timestamp": msg.zendesk_timestamp.isoformat() if msg.zendesk_timestamp else None
        } for msg in messages]
    }), 200


@app.route('/api/webhook-logs/stats', methods=['GET'])
def webhook_logs_stats():
    """Estatísticas dos logs de webhook"""
    from sqlalchemy import func
    
    stats = db.session.query(
        WebhookRawLog.processing_status,
        func.count(WebhookRawLog.id)
    ).group_by(WebhookRawLog.processing_status).all()
    
    total = WebhookRawLog.query.count()
    
    return jsonify({
        "total": total,
        "by_status": {status: count for status, count in stats}
    }), 200


# ===== MAIN =====

if __name__ == '__main__':
    logger.info(f"Iniciando N1ago em {HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=DEBUG)
