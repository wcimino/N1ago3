import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-3.5-turbo"

# Zendesk Configuration
ZENDESK_SUBDOMAIN = os.getenv("ZENDESK_SUBDOMAIN")
ZENDESK_API_KEY = os.getenv("ZENDESK_API_KEY")
ZENDESK_EMAIL = os.getenv("ZENDESK_EMAIL")
ZENDESK_KB_CATEGORY = "360004211092"

# Sunshine Conversations Configuration
SUNSHINE_KEY_ID = os.getenv("SUNSHINE_KEY_ID")
SUNSHINE_SECRET_KEY = os.getenv("SUNSHINE_SECRET_KEY")
SUNSHINE_SUBDOMAIN = os.getenv("SUNSHINE_SUBDOMAIN", ZENDESK_SUBDOMAIN)

# Flask Configuration
DEBUG = os.getenv("DEBUG", "False") == "True"
HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", 5000))

# Session Configuration
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret-key")

# Application Configuration
MAX_CONVERSATION_CONTEXT = 10  # número de mensagens anteriores a manter
ESCALATION_TIMEOUT = 600  # segundos (10 minutos)
FRUSTRATION_THRESHOLD = 0.7  # score de frustração para escalar
