"""Thread-safe sliding-window rate limiter for authentication endpoints."""

from collections import defaultdict, deque
import threading
import time
from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """In-memory per-(scope, client_ip) sliding-window rate limiter."""

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, scope: str, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        bucket_key = (scope, key)

        with self._lock:
            q = self._hits[bucket_key]
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= max_requests:
                retry_after = max(1, int(window_seconds - (now - q[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Please try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )
            q.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


auth_rate_limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extracts client IP respecting X-Forwarded-For behind reverse proxies."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
