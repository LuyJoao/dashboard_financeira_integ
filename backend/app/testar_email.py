"""Confere a configuração de SMTP sem passar pelo fluxo de senha: python -m app.testar_email destino@exemplo.com"""
import sys
from email.message import EmailMessage

from .core.config import settings
from .services.email import enviar_mensagem


def main(destino: str) -> None:
    if not settings.smtp_host:
        print("SMTP_HOST não está configurado no .env (modo desenvolvimento: o código só aparece no console).")
        sys.exit(1)
    msg = EmailMessage()
    msg["Subject"] = f"{settings.instituicao} – teste de e-mail"
    msg["To"] = destino
    msg.set_content("Se você recebeu esta mensagem, o envio de e-mail do sistema está funcionando.")
    print(f"Enviando para {destino} via {settings.smtp_host}:{settings.smtp_port} ({settings.smtp_seguranca})...")
    try:
        enviar_mensagem(msg)
    except Exception as e:  # aqui o erro precisa aparecer inteiro
        print(f"FALHOU: {type(e).__name__}: {e}")
        sys.exit(1)
    print("Enviado. Confira a caixa de entrada (e o spam).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: python -m app.testar_email destino@exemplo.com")
    main(sys.argv[1])
