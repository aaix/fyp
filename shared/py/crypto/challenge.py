import datetime
import json
import base64
from os import urandom

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature

from shared.py.pydantic.pem import PEMPublicKey






def create_challenge(ttl=5) -> bytes:
    version = 1
    crypto = base64.b64encode(urandom(32))
    now = datetime.datetime.now(datetime.UTC).timestamp()

    payload = {'v':version,'c': crypto, 'e': now + ttl}
    plaintext = json.dumps(payload)

    return plaintext.encode('utf-8')

def verify_challenge(pub_key: bytes | PEMPublicKey, ciphertext: bytes, plaintext: bytes) -> bool:
    """Verify an RSA-OAEP SHA256 signature"""
    key = pub_key if isinstance(pub_key, PEMPublicKey) else PEMPublicKey.from_bytes(pub_key)

    try:
        key.inner.verify(
            ciphertext,
            plaintext,
            padding=padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            ),
            algorithm=hashes.SHA256()
        )
    except InvalidSignature:
        return False
    return True


    
