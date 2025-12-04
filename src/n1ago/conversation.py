import json
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from openai import OpenAI
import os

logger = logging.getLogger(__name__)

class ConversationManager:
    """Gerencia conversas com contexto e histórico"""
    
    def __init__(self, openai_api_key: str):
        self.client = OpenAI(api_key=openai_api_key)
        self.conversations = {}  # session_id -> conversation history
        
    def start_conversation(self, session_id: str) -> None:
        """Inicia uma nova conversa"""
        self.conversations[session_id] = {
            "messages": [],
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
        logger.info(f"Conversa iniciada: {session_id}")
    
    def add_message(self, session_id: str, role: str, content: str) -> None:
        """Adiciona mensagem ao histórico"""
        if session_id not in self.conversations:
            self.start_conversation(session_id)
        
        self.conversations[session_id]["messages"].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat()
        })
    
    def get_response(self, session_id: str, user_message: str, knowledge_context: str = "", max_tokens: int = 500) -> str:
        """Obtém resposta do GPT-3.5-turbo com contexto da base de conhecimento"""
        try:
            # Adiciona mensagem do usuário
            self.add_message(session_id, "user", user_message)
            
            # Prepara mensagens para o modelo (últimas 10 para não exceder contexto)
            messages = self._get_conversation_history(session_id, limit=10)
            
            # System prompt com contexto
            system_prompt = self._build_system_prompt(knowledge_context)
            
            # Chamada OpenAI
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    *messages
                ],
                temperature=0.7,
                max_tokens=max_tokens,
                top_p=0.9
            )
            
            assistant_message = response.choices[0].message.content or "Erro ao gerar resposta"
            
            # Adiciona resposta ao histórico
            self.add_message(session_id, "assistant", assistant_message)
            
            return assistant_message
            
        except Exception as e:
            logger.error(f"Erro ao gerar resposta: {e}")
            return "Desculpe, tive um problema ao processar sua solicitação. Vou conectar você com um agente humano."
    
    def detect_escalation_intent(self, user_message: str) -> Tuple[bool, float]:
        """Detecta se o usuário quer escalar para atendimento humano"""
        escalation_keywords = [
            "falar com", "agente", "humano", "atendente", "gerente",
            "supervisor", "não entendi", "não funciona", "insatisfeito",
            "frustrado", "quero falar", "conecte", "passe adiante",
            "desisto", "problema", "erro", "bug", "falha"
        ]
        
        message_lower = user_message.lower()
        score = sum(1 for keyword in escalation_keywords if keyword in message_lower) / len(escalation_keywords)
        
        # Heurística simples - pode ser melhorada com análise de sentimento
        should_escalate = any(keyword in message_lower for keyword in [
            "falar com agente", "falar com humano", "atendente", "supervisor"
        ])
        
        return should_escalate, score
    
    def _get_conversation_history(self, session_id: str, limit: int = 10) -> List[Dict]:
        """Retorna histórico de conversa para enviar ao modelo"""
        if session_id not in self.conversations:
            return []
        
        messages = self.conversations[session_id]["messages"][-limit:]
        return [{"role": m["role"], "content": m["content"]} for m in messages]
    
    def _build_system_prompt(self, knowledge_context: str = "") -> str:
        """Constrói o system prompt para o modelo"""
        base_prompt = """Você é N1ago, um agente de atendimento especializado em crédito para a Movile Pay.
        
Sua responsabilidade é:
1. Responder dúvidas sobre crédito de forma clara, amigável e precisa
2. Usar a base de conhecimento fornecida para dar informações corretas
3. Se não souber a resposta, ser honesto e oferecer escalar para um agente humano
4. Ser atencioso aos problemas do cliente
5. Se perceber frustração ou solicitação expressa para falar com humano, ofereça escalar

Comunicação:
- Use tom profissional mas amigável
- Respostas concisas e diretas
- Se o cliente tiver pedido para escalar, comece oferecendo essa opção"""
        
        if knowledge_context:
            base_prompt += f"\n\nBase de conhecimento disponível:\n{knowledge_context}"
        
        return base_prompt
    
    def get_conversation_summary(self, session_id: str) -> str:
        """Retorna um resumo da conversa para transbordo"""
        if session_id not in self.conversations:
            return ""
        
        conv = self.conversations[session_id]
        messages = conv["messages"]
        
        summary_lines = [
            f"Conversa iniciada em: {conv['created_at']}",
            f"Total de mensagens: {len(messages)}",
            "\n--- Histórico ---\n"
        ]
        
        for msg in messages:
            role_display = "Cliente" if msg["role"] == "user" else "N1ago"
            summary_lines.append(f"[{role_display}] {msg['content'][:200]}")
        
        return "\n".join(summary_lines)
