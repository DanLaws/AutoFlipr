"""
Shared rate-limiter instance.

Import `limiter` into any route module and decorate handlers with
@limiter.limit("N/minute") — FastAPI will enforce the limit per client IP.

The app must also have:
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
  app.add_middleware(SlowAPIMiddleware)
(all wired in main.py)
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
