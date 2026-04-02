import logging

logger = logging.getLogger("api")

def log(m: object, level: int = logging.INFO):
    logger.log(level, m)
    print(m)