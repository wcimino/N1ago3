import requests
from typing import List, Dict, Optional
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

logger = logging.getLogger(__name__)

class KnowledgeBase:
    """Gerencia a base de conhecimento do Zendesk com busca semântica simples"""
    
    def __init__(self, zendesk_subdomain: str, zendesk_email: str, zendesk_api_key: str):
        self.zendesk_subdomain = zendesk_subdomain
        self.zendesk_email = zendesk_email
        self.zendesk_api_key = zendesk_api_key
        self.base_url = f"https://{zendesk_subdomain}.zendesk.com/api/v2"
        self.articles = []
        self.vectorizer = None
        self.article_vectors = None
        
    def load_articles(self, category_id: str = "360004211092") -> List[Dict]:
        """Carrega artigos da categoria especificada do Zendesk"""
        try:
            url = f"{self.base_url}/help_center/categories/{category_id}/articles.json"
            auth = (f"{self.zendesk_email}/token", self.zendesk_api_key)
            
            articles = []
            page = 1
            
            while url:
                response = requests.get(url, auth=auth, timeout=10)
                response.raise_for_status()
                
                data = response.json()
                articles.extend(data.get("articles", []))
                
                # Handle pagination
                url = data.get("links", {}).get("next")
                
            self.articles = articles
            logger.info(f"Carregados {len(articles)} artigos da base de conhecimento")
            
            # Build vectors for similarity search
            self._build_vectors()
            
            return articles
        except Exception as e:
            logger.error(f"Erro ao carregar artigos: {e}")
            return []
    
    def _build_vectors(self):
        """Constrói vetores TF-IDF para busca semântica"""
        if not self.articles:
            return
            
        texts = [f"{art.get('title', '')} {art.get('body', '')}" for art in self.articles]
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=500)
        self.article_vectors = self.vectorizer.fit_transform(texts)
    
    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """Busca artigos similares à query usando TF-IDF"""
        if not self.articles or self.vectorizer is None:
            logger.warning("Base de conhecimento vazia ou não indexada")
            return []
        
        try:
            query_vector = self.vectorizer.transform([query])
            similarities = cosine_similarity(query_vector, self.article_vectors)[0]
            
            # Get top k similar articles
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            results = []
            for idx in top_indices:
                if similarities[idx] > 0.1:  # Limiar mínimo de similaridade
                    article = self.articles[idx]
                    results.append({
                        "id": article.get("id"),
                        "title": article.get("title"),
                        "body": article.get("body", "")[:500],  # Primeiros 500 chars
                        "url": article.get("html_url"),
                        "similarity": float(similarities[idx])
                    })
            
            return results
        except Exception as e:
            logger.error(f"Erro na busca: {e}")
            return []
