from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql://carflip:changeme@localhost:5432/carflip"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-lite"

    # DVSA MOT
    dvsa_client_id: str = ""
    dvsa_client_secret: str = ""
    dvsa_api_url: str = "https://history.mot.api.gov.uk"

    # DVLA Vehicle Enquiry (optional — for reg plate lookup in Settings)
    dvla_api_key: str = ""

    # Auth — HTTP Basic admin access
    auth_user: str = "admin"
    auth_pass: str = "changeme"

    # Auth — JWT (user-facing)
    jwt_secret: str = "changeme-please-set-JWT_SECRET-in-env"

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


settings = Settings()
