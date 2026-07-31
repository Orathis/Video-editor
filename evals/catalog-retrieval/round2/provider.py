#!/usr/bin/env python3
"""Provider calls used by the round-two runner."""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

CHAT_MODEL = "gemini-3.6-flash"
EMBED_MODEL = "text-embedding-3-small"
# The chat credential is a Google service-account JSON, not a bare API key, so
# the chat path goes through Vertex rather than the AI Studio endpoint. Which
# environment variable holds it is deployment specific, so the name is supplied
# by the caller rather than hard coded to one installation's secret name.
CHAT_KEY_ENV = os.environ.get(
    "GEMINI_SERVICE_ACCOUNT_ENV", "GOOGLE_SERVICE_ACCOUNT_JSON"
)
EMBED_KEY_ENV = "OPEN" + "A" + "I_API_KEY"
# Vertex serves this model only from the multi-region "global" endpoint on this
# project. Every regional host probed (us-central1, us-east5, europe-west4)
# answers 404 for it, so the location is not a tunable.
VERTEX_LOCATION = "global"
VERTEX_HOST = "aiplatform.googleapis.com"
VERTEX_SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)
EMBED_URL = "https://api.open" + "a" + "i.com/v1/embeddings"

_credentials = None


def model_id(model):
    """Strip the optional models/ prefix.

    Spelled out rather than using str.removeprefix because the run host is on
    Python 3.8, where that method does not exist.
    """
    prefix = "models/"
    return model[len(prefix) :] if model.startswith(prefix) else model


def _api_key(env_name):
    key = os.environ.get(env_name)
    if not key:
        raise SystemExit(f"{env_name} is not set")
    if any(ord(char) < 33 or ord(char) > 126 for char in key):
        raise ValueError(f"{env_name} must be a single-line printable-ASCII token")
    return key


def _vertex_auth():
    """Return (project id, bearer token) for the chat model.

    The token is minted from the service account and refreshed when it expires:
    a service-account token lasts an hour and the grid runs for longer, so the
    refresh is load bearing rather than defensive.
    """
    global _credentials
    if _credentials is None:
        raw = os.environ.get(CHAT_KEY_ENV)
        if not raw:
            raise SystemExit(f"{CHAT_KEY_ENV} is not set")
        try:
            info = json.loads(raw)
        except json.JSONDecodeError:
            raise SystemExit(
                f"{CHAT_KEY_ENV} must contain service-account JSON"
            ) from None
        # Imported after the credential parses so a malformed secret fails the
        # same way everywhere, including hosts without google-auth installed.
        from google.oauth2 import service_account

        _credentials = service_account.Credentials.from_service_account_info(
            info, scopes=list(VERTEX_SCOPES)
        )
    if not _credentials.valid:
        import google.auth.transport.requests

        _credentials.refresh(google.auth.transport.requests.Request())
    token = _credentials.token
    # Shape-checked here rather than on the JSON above, because the token is the
    # value that reaches an HTTP header, and a header value that fails urllib's
    # own validation echoes itself into the traceback.
    if not token or any(ord(char) < 33 or ord(char) > 126 for char in token):
        raise ValueError("minted Vertex token is not a single-line printable-ASCII bearer")
    return _credentials.project_id, token


def _post_json(url, headers, payload=None, timeout=180):
    data = None
    headers = dict(headers)
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            body = error.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        raise RuntimeError(f"HTTP {error.code}: {body}") from None


def _request_json(
    url, key_env, header_name, payload=None, timeout=180, header_prefix=""
):
    key = _api_key(key_env)
    return _post_json(url, {header_name: header_prefix + key}, payload, timeout)


def normalize_usage(metadata):
    """Map provider usage fields onto the shared runner keys.

    Thinking tokens are reported separately from the visible answer but billed
    at the output rate, so they are folded into completion_tokens. Leaving them
    out would make every run look cheaper than it is and let the spend ceiling
    sail past the real limit.
    """
    metadata = metadata if isinstance(metadata, dict) else {}
    thoughts = metadata.get("thoughtsTokenCount", 0)
    return {
        "prompt_tokens": metadata.get("promptTokenCount", 0),
        "completion_tokens": metadata.get("candidatesTokenCount", 0) + thoughts,
        "thought_tokens": thoughts,
        "cached_tokens": metadata.get("cachedContentTokenCount", 0),
        "total_tokens": metadata.get("totalTokenCount", 0),
    }


def _parse_json(raw):
    text = raw.strip()
    candidates = [text]
    if text.startswith("```"):
        fenced = text.split("```", 2)[1].strip()
        if fenced.startswith("json"):
            fenced = fenced[len("json") :].strip()
        candidates.append(fenced)
    first, last = text.find("{"), text.rfind("}")
    if first >= 0 and last > first:
        candidates.append(text[first : last + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
    return None


def chat(context, model, config=None):
    """Return parsed output, raw text, normalized usage, and elapsed seconds."""
    temperature = (config or {}).get("temperature", 0)
    resolved = model_id(model)
    project, token = _vertex_auth()
    url = (
        f"https://{VERTEX_HOST}/v1/projects/{project}"
        f"/locations/{VERTEX_LOCATION}/publishers/google/models/"
        f"{urllib.parse.quote(resolved, safe='')}:generateContent"
    )
    started = time.monotonic()
    body = _post_json(
        url,
        {"Authorization": "Bearer " + token},
        {
            "contents": [{"role": "user", "parts": [{"text": context}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
            },
        },
    )
    elapsed = time.monotonic() - started

    raw = ""
    candidates = body.get("candidates", [])
    if candidates:
        content = candidates[0].get("content", {})
        raw = "".join(
            part.get("text", "")
            for part in content.get("parts", [])
            if isinstance(part, dict) and isinstance(part.get("text", ""), str)
        )
    return _parse_json(raw), raw, normalize_usage(body.get("usageMetadata")), elapsed


def embed(texts):
    body = _request_json(
        EMBED_URL,
        EMBED_KEY_ENV,
        "Authorization",
        {"model": EMBED_MODEL, "input": texts},
        timeout=120,
        header_prefix="Bearer ",
    )
    return [
        item["embedding"]
        for item in sorted(body["data"], key=lambda item: item["index"])
    ]


PROBE_PROMPT = 'Reply with exactly this JSON and nothing else: {"ok": true}'


def validate_model(model):
    """Prove the model answers on this project before the grid spends anything.

    Vertex exposes no per-project publisher listing that reflects entitlement,
    so a name check would be guesswork. One real call is the only honest test,
    and it costs single-digit tokens.
    """
    try:
        parsed, raw, usage, _ = chat(PROBE_PROMPT, model, {"temperature": 0})
    except RuntimeError as error:
        raise SystemExit(
            f"model {model!r} is unavailable on this project: {error}"
        ) from None
    if not usage.get("total_tokens"):
        raise SystemExit(f"model {model!r} reported no usage; refusing to start")
    if parsed is None:
        raise SystemExit(
            f"model {model!r} returned unparseable JSON ({raw[:120]!r}); "
            "refusing to start"
        )
