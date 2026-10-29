import asyncio
import re

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from domain.live_updates import TOPICS, authorised_topics, hub, read_scope

router = APIRouter(tags=["Live updates"])


@router.websocket("/live")
async def live_updates(socket: WebSocket):
    origin = socket.headers.get("origin")
    if origin and origin not in socket.app.state.live_origins and not re.fullmatch(socket.app.state.live_origin_regex, origin):
        await socket.close(code=1008)
        return
    await socket.accept()
    queue = None
    disconnected = None
    try:
        # Never put bearer credentials in URLs, logs or broadcast payloads.
        auth = await asyncio.wait_for(socket.receive_text(), timeout=5)
        if len(auth) > 4096:
            await socket.close(code=1008)
            return
        import json
        token = json.loads(auth).get("token", "")
        scope = await run_in_threadpool(read_scope, token)
        if not hub.ready:
            await socket.close(code=1013)
            return
        queue = hub.subscribe()
        disconnected = asyncio.create_task(socket.receive())
        await socket.send_json({"type": "ready", "topics": sorted(TOPICS - ({"registry"} if scope["role"] != "admin" else set()))})
        while True:
            next_change = asyncio.create_task(queue.get())
            try:
                done, _ = await asyncio.wait({next_change, disconnected}, timeout=20, return_when=asyncio.FIRST_COMPLETED)
                if disconnected in done:
                    return
                change = next_change.result() if next_change in done else None
            finally:
                next_change.cancel()
            # Refresh account status, JWT expiry and course access before each batch/heartbeat.
            scope = await run_in_threadpool(read_scope, token)
            if not hub.ready:
                await socket.close(code=1013)
                return
            if change is None:
                await socket.send_json({"type": "heartbeat"})
                continue
            batch = [change]
            while not queue.empty():
                batch.append(queue.get_nowait())
            topics = set()
            for item in batch:
                topics.update(TOPICS - ({"registry"} if scope["role"] != "admin" else set()) if item.get("resync") else authorised_topics(item, scope))
            if topics:
                await socket.send_json({"type": "invalidate", "topics": sorted(topics)})
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await socket.close(code=1008)
        except RuntimeError:
            pass
    finally:
        if disconnected is not None:
            disconnected.cancel()
        if queue is not None:
            hub.queues.discard(queue)
