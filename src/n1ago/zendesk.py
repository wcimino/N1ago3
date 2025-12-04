import requests
import logging
from typing import Dict, Optional
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

class ZendeskClient:
    """Cliente para Zendesk API"""
    
    def __init__(self, subdomain: str, email: str, api_key: str):
        self.subdomain = subdomain
        self.email = email
        self.api_key = api_key
        self.base_url = f"https://{subdomain}.zendesk.com/api/v2"
        self.auth = (f"{email}/token", api_key)
    
    def create_ticket(self, subject: str, description: str, requester_email: Optional[str] = None, tags: Optional[list] = None) -> Optional[Dict]:
        """Cria um ticket no Zendesk"""
        try:
            url = f"{self.base_url}/tickets.json"
            
            payload = {
                "ticket": {
                    "subject": subject,
                    "description": description,
                    "priority": "normal",
                    "tags": tags or ["n1ago_escalation", "credit"]
                }
            }
            
            if requester_email:
                payload["ticket"]["requester"] = {
                    "email": requester_email
                }
            
            response = requests.post(
                url,
                json=payload,
                auth=self.auth,
                timeout=10,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [200, 201]:
                ticket_data = response.json()
                logger.info(f"Ticket criado: {ticket_data['ticket']['id']}")
                return ticket_data["ticket"]
            else:
                logger.error(f"Erro ao criar ticket: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Erro ao criar ticket: {e}")
            return None
    
    def search_articles(self, query: str, category_id: str = "360004211092") -> list:
        """Busca artigos na base de conhecimento"""
        try:
            url = f"{self.base_url}/help_center/articles/search.json"
            
            params = {
                "category": category_id,
                "query": query
            }
            
            response = requests.get(
                url,
                params=params,
                auth=self.auth,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json().get("results", [])
            else:
                logger.error(f"Erro na busca: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Erro ao buscar artigos: {e}")
            return []
