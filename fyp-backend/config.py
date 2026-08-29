import logging
import os

from dotenv import load_dotenv


load_dotenv()

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_CHAT_MODEL = os.getenv(
    "OPENROUTER_CHAT_MODEL", "z-ai/glm-5.2:free"
).strip()
OPENROUTER_CHAT_FALLBACK_MODEL = os.getenv(
    "OPENROUTER_CHAT_FALLBACK_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free"
).strip()
OPENROUTER_EMBEDDING_MODEL = os.getenv(
    "OPENROUTER_EMBEDDING_MODEL", "nvidia/nemotron-3-embed-1b:free"
).strip()

if not OPENROUTER_API_KEY:
    logger.error("OPENROUTER_API_KEY is not configured. AI Assistant requests are disabled.")
