from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "postgresql+psycopg://app:app@localhost:5432/pagamentos"
    secret_key: str = "troque-esta-chave"
    access_token_minutes: int = 60
    reset_token_minutes: int = 30
    reset_intervalo_segundos: int = 60  # mínimo entre dois pedidos de código para o mesmo e-mail
    instituicao: str = "INTEG"  # aparece no cabeçalho do dashboard
    cors_origins: list[str] = ["http://localhost:5173", "null"]

    # E-mail (SMTP). Com SMTP_HOST vazio o código só aparece no console da API (modo desenvolvimento).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_seguranca: Literal["starttls", "ssl", "nenhuma"] = "starttls"  # 587 = starttls, 465 = ssl
    smtp_usuario: str = ""
    smtp_senha: str = ""
    smtp_remetente: str = ""  # ex.: INTEG <naoresponda@integ.org.br>; vazio = usa SMTP_USUARIO
    smtp_timeout: int = 15
    smtp_validar_certificado: bool = True  # só desligue para servidor interno com certificado próprio


settings = Settings()
