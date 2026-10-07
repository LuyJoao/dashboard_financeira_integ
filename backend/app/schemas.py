from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    senha: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    email: EmailStr
    role: str
    ativo: bool


class UsuarioCreate(BaseModel):
    nome: str = Field(min_length=2)
    email: EmailStr
    senha: str = Field(min_length=8)
    role: Literal["admin", "user"] = "user"


class EsqueciSenhaIn(BaseModel):
    email: EmailStr


class RedefinirSenhaIn(BaseModel):
    codigo: str
    nova_senha: str = Field(min_length=8)
