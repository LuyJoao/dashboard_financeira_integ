from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "postgresql+psycopg://app:app@localhost:5432/pagamentos"
    secret_key: str = "troque-esta-chave"
    access_token_minutes: int = 60
    reset_token_minutes: int = 30
    cors_origins: list[str] = ["http://localhost:5173", "null"]


settings = Settings()
