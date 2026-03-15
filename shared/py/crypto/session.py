import json

from joserfc import jws, jwe, jwk

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes

from shared.py.discovery import DiscoveryManager

discovery = DiscoveryManager()


CONF_SIGN_KEY = jwk.import_key(json.loads(discovery.find_key("API_SESSION_SIGNING_KEY")))
CONF_ENCRYPT_KEY = jwk.import_key(json.loads(discovery.find_key("API_SESSION_ENCRYPTION_KEY")))

def encode_jose_session(data: bytes) -> str:
    token = jws.serialize_compact({"alg": "HS256"}, data, private_key=CONF_SIGN_KEY, algorithms=["HS256"])
    return jwe.encrypt_compact({"alg": "A256KW", "enc": "A256GCM"}, token, public_key=CONF_ENCRYPT_KEY, algorithms=["A256GCM", "A256KW"])

def decode_jose_session(data: str) -> bytes:
    token = jwe.decrypt_compact(data, private_key=CONF_ENCRYPT_KEY, algorithms=["A256GCM", "A256KW"])
    assert token.plaintext is not None
    return jws.deserialize_compact(token.plaintext, public_key=CONF_SIGN_KEY, algorithms=["HS256"]).payload

def encrypt_session_with_key(session: str, raw_key: bytes) -> bytes:
    key: rsa.RSAPublicKey = serialization.load_pem_public_key(raw_key) # pyright: ignore[reportAssignmentType]

    plaintext = session.encode(encoding="utf-8")

    ciphertext = key.encrypt(
        plaintext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    return ciphertext

    
