from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULTS = {
    "changeme",
    "changeme-please-set-JWT_SECRET-in-env",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql://autoflipr:changeme@localhost:5432/autoflipr"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Gemini — comma-separated list of API keys for rotation across projects
    gemini_api_keys: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"
    # When set, this worker uses only the key at this index (0-based) from gemini_api_keys.
    # Each worker-llm-N process is pinned to key N via supervisord environment.
    gemini_key_index: int = -1

    @property
    def gemini_key_list(self) -> list[str]:
        keys = [k.strip() for k in self.gemini_api_keys.split(",") if k.strip()]
        if self.gemini_key_index >= 0 and self.gemini_key_index < len(keys):
            return [keys[self.gemini_key_index]]
        return keys

    # DVSA MOT
    dvsa_client_id: str = ""
    dvsa_client_secret: str = ""
    dvsa_api_url: str = "https://history.mot.api.gov.uk"

    # DVLA Vehicle Enquiry (optional — for reg plate lookup in Settings)
    dvla_api_key: str = ""

    # CORS — comma-separated list of allowed origins, e.g. "https://app.autoflipr.com"
    # Defaults cover local dev; override in production via CORS_ORIGINS env var.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # Auth — HTTP Basic admin access
    auth_user: str = "admin"
    auth_pass: str = "changeme"

    # Auth — JWT (user-facing)
    jwt_secret: str = "changeme-please-set-JWT_SECRET-in-env"

    # App base URL — used to build links in transactional emails
    app_url: str = "https://autoflipr.com"

    # Resend transactional email
    resend_api_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_basic_monthly: str = ""
    stripe_price_basic_annual: str = ""
    stripe_price_pro_monthly: str = ""
    stripe_price_pro_annual: str = ""

    # Proxy (optional)
    proxy_url: str = ""

    # Scraper — AutoTrader
    autotrader_rate_limit: int = 30
    autotrader_search_radius: int = 50
    autotrader_search_postcode: str = "SW1A1AA"

    # Scraper — Gumtree
    gumtree_cdp_url: str = ""  # unused — kept for config compat, scraper uses headless
    gumtree_search_location: str = "uk"
    gumtree_max_price: int = 0   # 0 = no limit

    # Scraper — Facebook Marketplace
    # Path to a JSON file containing exported Facebook session cookies.
    # Export using a browser extension (e.g. "Cookie-Editor") after logging in to facebook.com.
    fb_cookies_path: str = "/data/facebook_cookies.json"
    fb_latitude: float = 50.7192   # Default: Bournemouth
    fb_longitude: float = -1.8808
    fb_radius_km: int = 80
    fb_max_price: int = 15000
    fb_min_price: int = 500

    @model_validator(mode="after")
    def _reject_insecure_defaults(self) -> "Settings":
        if self.jwt_secret in _INSECURE_DEFAULTS:
            raise ValueError(
                "JWT_SECRET is set to an insecure default — set it in your .env file"
            )
        if self.auth_pass in _INSECURE_DEFAULTS:
            raise ValueError(
                "AUTH_PASS is set to an insecure default — set it in your .env file"
            )
        return self


settings = Settings()
