"""
ComfyUI CreativeCode - frame-based shader renderer with preview UI.
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

try:
    from .server_routes import setup_routes
    setup_routes()
except Exception as e:
    print(f"[CreativeCode] Warning: Could not setup HTTP routes: {e}")

WEB_DIRECTORY = "./js"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]
