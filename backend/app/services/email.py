"""Envio de e-mail por SMTP (biblioteca padrão, sem dependências extras)."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from ..core.config import settings

logger = logging.getLogger("app.email")


def _remetente() -> str:
    return settings.smtp_remetente or settings.smtp_usuario


def _contexto_tls() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if not settings.smtp_validar_certificado:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def enviar_mensagem(msg: EmailMessage) -> None:
    """Entrega a mensagem pelo SMTP configurado. Levanta exceção se algo falhar (quem chama decide o que fazer)."""
    if not settings.smtp_host:
        raise RuntimeError("SMTP_HOST não está configurado")
    remetente = str(msg["From"] or "") or _remetente()
    if not remetente:
        raise RuntimeError("Defina SMTP_REMETENTE (ou SMTP_USUARIO) no .env")
    del msg["From"]
    msg["From"] = remetente
    ctx = _contexto_tls()
    if settings.smtp_seguranca == "ssl":
        servidor = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout, context=ctx)
    else:
        servidor = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout)
    with servidor as s:
        if settings.smtp_seguranca == "starttls":
            s.starttls(context=ctx)
        if settings.smtp_usuario:
            s.login(settings.smtp_usuario, settings.smtp_senha)
        s.send_message(msg)


def _mensagem_reset(destino: str, codigo: str) -> EmailMessage:
    msg = EmailMessage()  # cuida da codificação (acentos) e impede injeção de cabeçalhos
    msg["Subject"] = f"{settings.instituicao} – código para redefinir sua senha"
    msg["From"] = _remetente()
    msg["To"] = destino
    msg.set_content(
        f"Olá,\n\n"
        f"Recebemos um pedido para redefinir a senha da sua conta no sistema financeiro da {settings.instituicao}.\n\n"
        f"Seu código: {codigo}\n\n"
        f"Ele vale por {settings.reset_token_minutes} minutos e só pode ser usado uma vez. "
        f"Cole o código na tela \"Redefinir senha\" do aplicativo.\n\n"
        f"Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.\n"
    )
    return msg


def enviar_reset(email: str, codigo: str) -> None:
    """Envia o código de redefinição. Nunca levanta exceção: roda em segundo plano, depois da resposta à tela,
    e a resposta do "esqueci a senha" é sempre a mesma. Falhas vão para o log (sem o código)."""
    if not settings.smtp_host:
        print(f"[DEV] Código de redefinição de senha para {email}: {codigo}")
        return
    try:
        enviar_mensagem(_mensagem_reset(email, codigo))
    except Exception:
        logger.exception("Falha ao enviar o código de redefinição para %s (SMTP %s:%s)", email, settings.smtp_host, settings.smtp_port)
