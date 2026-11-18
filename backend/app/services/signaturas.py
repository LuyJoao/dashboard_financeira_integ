import hashlib
import json
from datetime import date


def assinatura_importacao(
    banco: str,
    data: date,
    descricao_original: str,
    valor_centavos: int,
    documento: str | None,
) -> str:
    payload = [banco, data.isoformat(), descricao_original, int(valor_centavos), documento]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
