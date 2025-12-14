from joserfc import jws, jwe, jwk

SIGN_KEY = jwk.generate_key("oct", 256)
ENCRYPT_KEY = jwk.generate_key("oct", 256)

def encode_jose_session(data: str) -> str:
    token = jws.serialize_compact({"alg": "HS256"}, data, private_key=SIGN_KEY, algorithms=["HS256"])
    return jwe.encrypt_compact({"alg": "A256KW", "enc": "A256GCM"}, token, public_key=ENCRYPT_KEY, algorithms=["A256GCM", "A256KW"])

def decode_jose_session(data: str) -> bytes:
    token = jwe.decrypt_compact(data, private_key=ENCRYPT_KEY, algorithms=["A256GCM", "A256KW"])
    assert token.plaintext is not None
    return jws.deserialize_compact(token.plaintext, public_key=SIGN_KEY, algorithms=["HS256"]).payload
