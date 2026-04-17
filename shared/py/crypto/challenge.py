import datetime
import json
import base64
import secrets

from hashlib import sha256
from os import urandom
from dataclasses import dataclass

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes


from shared.py.pydantic.pem import PEMPublicKey

@dataclass(kw_only=True)
class Challenge:
    """Dont confuse the ciphertext and plaintext"""
    ciphertext: bytes
    digest: bytes
    expiry: float


def create_challenge(pub_key: PEMPublicKey | bytes, ttl=5) -> Challenge:
    key = pub_key if isinstance(pub_key, PEMPublicKey) else PEMPublicKey.from_bytes(pub_key)

    version = 2
    crypto = base64.b64encode(urandom(32)).decode()
    now = datetime.datetime.now(datetime.UTC).timestamp()
    expiry = now + ttl

    payload = {'v':version,'c': crypto, 'e': expiry}
    plaintext = json.dumps(payload).encode()

    ciphertext = key.inner.encrypt(
        plaintext,
        padding=padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        ),
    )
    return Challenge(ciphertext=ciphertext, digest=sha256(plaintext).digest(), expiry=expiry)

    

def verify_challenge(clienttext: bytes, challenge: Challenge) -> bool:
    now = datetime.datetime.now(datetime.UTC).timestamp()
    
    still_valid = now < challenge.expiry

    digest_valid = secrets.compare_digest(clienttext, challenge.digest)

    return (still_valid + digest_valid) == 2


    
