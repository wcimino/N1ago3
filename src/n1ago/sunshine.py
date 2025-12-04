import requests
import logging
from typing import Dict, Optional
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

class SunshineConversationsClient:
    """Cliente para Sunshine Conversations API"""
    
    def __init__(self, subdomain: str, key_id: str, secret_key: str):
        self.subdomain = subdomain
        self.key_id = key_id
        self.secret_key = secret_key
        self.base_url = f"https://{subdomain}.zendesk.com/sc/v2"
        self.auth = HTTPBasicAuth(key_id, secret_key)
    
    def send_message(self, app_id: str, conversation_id: str, text: str, author_type: str = "business") -> bool:
        """Envia uma mensagem via Sunshine Conversations"""
        try:
            url = f"{self.base_url}/apps/{app_id}/conversations/{conversation_id}/messages"
            
            payload = {
                "author": {
                    "type": author_type
                },
                "content": {
                    "type": "text",
                    "text": text
                }
            }
            
            response = requests.post(
                url,
                json=payload,
                auth=self.auth,
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Mensagem enviada para conversa {conversation_id}")
                return True
            else:
                logger.error(f"Erro ao enviar mensagem: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Erro na comunicação com Sunshine: {e}")
            return False
    
    def get_conversation(self, app_id: str, conversation_id: str) -> Optional[Dict]:
        """Obtém detalhes de uma conversa"""
        try:
            url = f"{self.base_url}/apps/{app_id}/conversations/{conversation_id}"
            
            response = requests.get(
                url,
                auth=self.auth,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Erro ao buscar conversa: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Erro ao buscar conversa: {e}")
            return None
