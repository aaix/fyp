from typing import cast

from fastapi import APIRouter

from api import *
from api.middleware.auth import SessionParam
from api.routes.channel.models import *

from shared.py.intraservice import client as intraclient



discovery = DiscoveryManager()

MessageRouter = APIRouter()


