import datetime
import json
import base64
import secrets
from os import urandom
from dataclasses import dataclass

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes

from gateway import log
from shared.py.pydantic.pem import PEMPublicKey

@dataclass(kw_only=True)
class Challenge:
    """Dont confuse the ciphertext and plaintext"""
    ciphertext: bytes
    plaintext: bytes


def create_challenge(pub_key: PEMPublicKey | bytes, ttl=5) -> Challenge:
    key = pub_key if isinstance(pub_key, PEMPublicKey) else PEMPublicKey.from_bytes(pub_key)

    version = 1
    crypto = base64.b64encode(urandom(32)).decode()
    now = datetime.datetime.now(datetime.UTC).timestamp()

    payload = {'v':version,'c': crypto, 'e': now + ttl}
    plaintext = json.dumps(payload).encode()

    ciphertext = key.inner.encrypt(
        plaintext,
        padding=padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        ),
    )
    return Challenge(ciphertext=ciphertext, plaintext=plaintext)

    

def verify_challenge(clienttext: bytes, challenge: Challenge) -> bool:
    return secrets.compare_digest(clienttext, challenge.plaintext)


    
