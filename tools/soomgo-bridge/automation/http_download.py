"""HTTPS 바이트 다운로드 — Windows·회사 프록시 SSL 검증 실패 대응."""
from __future__ import annotations

import ssl
from urllib.request import Request, urlopen


def _is_ssl_cert_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    if 'certificate_verify_failed' in msg or 'ssl: certificate' in msg:
        return True
    reason = getattr(exc, 'reason', None)
    if reason is not None and reason is not exc:
        return _is_ssl_cert_error(reason)
    return False


def _ssl_contexts() -> list[ssl.SSLContext]:
    contexts: list[ssl.SSLContext] = []
    try:
        import certifi

        contexts.append(ssl.create_default_context(cafile=certifi.where()))
    except ImportError:
        pass
    contexts.append(ssl.create_default_context())
    fallback = ssl.create_default_context()
    fallback.check_hostname = False
    fallback.verify_mode = ssl.CERT_NONE
    contexts.append(fallback)
    return contexts


def download_bytes(
    url: str,
    *,
    timeout: float = 30,
    user_agent: str = 'Cbiseo-SoomgoBridge/2.1',
) -> bytes:
    req = Request(url, headers={'User-Agent': user_agent})
    last_ssl_error: Exception | None = None

    try:
        with urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception as e:
        if not _is_ssl_cert_error(e):
            raise
        last_ssl_error = e

    for ctx in _ssl_contexts():
        try:
            with urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.read()
        except Exception as e:
            if not _is_ssl_cert_error(e):
                raise
            last_ssl_error = e

    if last_ssl_error is not None:
        raise last_ssl_error
    raise RuntimeError('download failed')
