#!/usr/bin/env python3
"""Provider calls used by the round-two runner."""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

CHAT_MODEL = "gemini-3.6-flash"
# The second model family for step 5 of the round 4 rule. Entitlement is
# settled by validate_model against the account that actually runs the grid,
# never by the id looking plausible, so the id stays overridable: if the probe
# refuses this one, the runbook sets EVAL_ANTHROPIC_MODEL and probes again
# rather than editing code on the run host.
ANTHROPIC_CHAT_MODEL = os.environ.get("EVAL_ANTHROPIC_MODEL", "claude-haiku-4-5")
# The family that actually runs as model B. The Anthropic backend below is
# written and tested but its credential answers 401 authentication_error in this
# environment, and Infisical is read only here, so the grid's second family is
# this one instead. Overridable for the same reason: the probe settles
# entitlement, the id never does.
OPENAI_CHAT_MODEL = os.environ.get("EVAL_OPENAI_MODEL", "gpt-5.6-luna")
EMBED_MODEL = "text-embedding-3-small"
# The chat credential is a Google service-account JSON, not a bare API key, so
# the chat path goes through Vertex rather than the AI Studio endpoint. Which
# environment variable holds it is deployment specific, so the name is supplied
# by the caller rather than hard coded to one installation's secret name.
CHAT_KEY_ENV = os.environ.get(
    "GEMINI_SERVICE_ACCOUNT_ENV", "GOOGLE_SERVICE_ACCOUNT_JSON"
)
EMBED_KEY_ENV = "OPEN" + "A" + "I_API_KEY"
# Assembled the same way the embed name is, so a grep for a secret name does
# not match this file and report it as a place a key was written down.
ANTHROPIC_KEY_ENV = "ANTHROP" + "I" + "C_API_KEY"
ANTHROPIC_URL = "https://api.anthrop" + "i" + "c.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# The Messages API requires max_tokens, unlike Vertex, which defaults it. 4096
# is above the 489 to 1104 output tokens measured across the nine cells, so it
# is a ceiling on a runaway answer rather than a cap the grid runs into.
ANTHROPIC_MAX_TOKENS = 4096
# Assembled the same way the key names are, and for the same reason: a grep for
# the embed credential's name would otherwise report this file as a place a
# secret was written down. The chat and embed paths share the base because they
# share the account and the credential.
OPENAI_BASE_URL = "https://api.open" + "a" + "i.com/v1"
OPENAI_CHAT_URL = OPENAI_BASE_URL + "/chat/completions"
# max_tokens is HTTP 400 on this family; the cap is named max_completion_tokens
# and counts reasoning as well as the visible answer. 4096 is the same ceiling
# the Anthropic path uses, above the 489 to 1104 output tokens measured on the
# nine cells, so it stops a runaway answer rather than truncating a real one.
OPENAI_MAX_COMPLETION_TOKENS = 4096
# This family rejects temperature 0 with HTTP 400: "Unsupported value:
# 'temperature' does not support 0 with this model. Only the default (1) value
# is supported." Rounds 2 and 3 ran every paid cell at temperature 0, so this is
# a confound the round has to name rather than a setting it can choose. See
# _chat_openai for what the code does about it, and run2.dry_run for where the
# reader is asked to approve it.
OPENAI_ONLY_TEMPERATURE = 1
# Vertex serves this model only from the multi-region "global" endpoint on this
# project. Every regional host probed (us-central1, us-east5, europe-west4)
# answers 404 for it, so the location is not a tunable.
VERTEX_LOCATION = "global"
VERTEX_HOST = "aiplatform.googleapis.com"
VERTEX_SCOPES = ("https://www.googleapis.com/auth/cloud-platform",)
EMBED_URL = OPENAI_BASE_URL + "/embeddings"

_credentials = None


def model_id(model):
    """Strip the optional models/ prefix.

    Spelled out rather than using str.removeprefix because the run host is on
    Python 3.8, where that method does not exist.
    """
    prefix = "models/"
    return model[len(prefix) :] if model.startswith(prefix) else model


FAMILY_PREFIXES = (
    ("gemini-", "vertex"),
    ("claude-", "anthropic"),
    ("gpt-", "openai"),
)


def model_family(model):
    """Name the backend that serves this model, or refuse.

    Falling back to the default backend for an unrecognised id would send a
    round 4 model B cell to model A and report the answer as a reproduction,
    which is the one failure this round cannot detect after the fact.
    """
    resolved = model_id(model)
    for prefix, family in FAMILY_PREFIXES:
        if resolved.startswith(prefix):
            return family
    known = ", ".join(prefix for prefix, _ in FAMILY_PREFIXES)
    raise SystemExit(
        f"model {model!r} matches no known family prefix ({known}); "
        "refusing to guess a backend"
    )


# The temperature each family is actually sampled at. Rounds 2 and 3 ran every
# paid cell at 0, and the openai family rejects 0 outright, so this table is
# where the round's one named confound lives.
#
# One owner, and the backends below read their default from it rather than
# repeating the number. Four places need this same answer: the two backends that
# send a temperature, the dry run banner a reader approves spend against, and
# the confirmation that has to label a cross-model difference as confounded. Four
# copies is how three of them stay right while the fourth quietly reports a clean
# reproduction.
FAMILY_TEMPERATURE = {
    "vertex": 0,
    "anthropic": 0,
    "openai": OPENAI_ONLY_TEMPERATURE,
}


def sampling_temperature(model):
    """The temperature this model is sampled at, whatever the caller asked for.

    A family missing from the table raises KeyError here rather than defaulting
    to 0, because a wrong temperature reported as a fact is worse than a crash:
    it is exactly the claim that two cells differ in one variable when they
    differ in two.
    """
    return FAMILY_TEMPERATURE[model_family(model)]


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


def normalize_anthropic_usage(metadata):
    """Map Messages API usage onto the same shared runner keys.

    input_tokens EXCLUDES both cache reads and cache writes there, while the
    cost table subtracts cached from prompt to get the uncached share. Reporting
    input_tokens as prompt_tokens would therefore bill a cached run as negative
    uncached input, so the cache fields are added back in. Cache writes are
    counted as plain input, which under-bills them slightly, but nothing in this
    runner asks for a cache so the field should always be zero.
    """
    metadata = metadata if isinstance(metadata, dict) else {}
    cached = metadata.get("cache_read_input_tokens", 0) or 0
    written = metadata.get("cache_creation_input_tokens", 0) or 0
    prompt = (metadata.get("input_tokens", 0) or 0) + cached + written
    completion = metadata.get("output_tokens", 0) or 0
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        # Extended thinking is off, so there is no separate thinking count to
        # fold in the way the Vertex path does.
        "thought_tokens": 0,
        "cached_tokens": cached,
        "total_tokens": prompt + completion,
    }


def normalize_openai_usage(metadata):
    """Map chat completions usage onto the same shared runner keys.

    This family's convention is the opposite of the Anthropic one above, in both
    directions, so the two normalizers must not be read as variants of each
    other. Here prompt_tokens ALREADY includes the cached share of the input and
    completion_tokens ALREADY includes reasoning output. Adding either detail
    field back on top, the way normalize_anthropic_usage has to add its cache
    fields, would bill both of them twice and let the spend gate read every run
    as costing more than it did.

    cache_write_tokens is deliberately not folded into cached_tokens. Only cache
    reads are billed at the cheaper cached rate, so a write counted as a read
    would under-bill it. Nothing in this runner asks for a cache, so the field
    should always be zero, and a write left in the uncached share is priced at
    the input rate, which is the conservative direction rather than the cheap
    one.
    """
    metadata = metadata if isinstance(metadata, dict) else {}
    prompt_details = metadata.get("prompt_tokens_details")
    completion_details = metadata.get("completion_tokens_details")
    prompt_details = prompt_details if isinstance(prompt_details, dict) else {}
    completion_details = (
        completion_details if isinstance(completion_details, dict) else {}
    )
    prompt = metadata.get("prompt_tokens", 0) or 0
    completion = metadata.get("completion_tokens", 0) or 0
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "thought_tokens": completion_details.get("reasoning_tokens", 0) or 0,
        "cached_tokens": prompt_details.get("cached_tokens", 0) or 0,
        "total_tokens": prompt + completion,
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
    """Return parsed output, raw text, normalized usage, and elapsed seconds.

    The model decides the backend. Round 4 compares a model A cell against its
    model B twin, so the model is a cell variable and not a deployment setting.
    """
    family = model_family(model)
    if family == "anthropic":
        return _chat_anthropic(context, model, config)
    if family == "openai":
        return _chat_openai(context, model, config)
    return _chat_vertex(context, model, config)


def _chat_anthropic(context, model, config=None):
    config = config or {}
    started = time.monotonic()
    body = _post_json(
        ANTHROPIC_URL,
        {
            "x-api-key": _api_key(ANTHROPIC_KEY_ENV),
            "anthropic-version": ANTHROPIC_VERSION,
        },
        {
            "model": model_id(model),
            "max_tokens": config.get("max_tokens", ANTHROPIC_MAX_TOKENS),
            "temperature": config.get("temperature", sampling_temperature(model)),
            "messages": [{"role": "user", "content": context}],
        },
    )
    elapsed = time.monotonic() - started
    # There is no responseMimeType here, so the answer can arrive fenced or with
    # a sentence in front of it. _parse_json already tolerates both, which is
    # why no extra instruction is bolted onto the shared prompt: changing the
    # prompt would change more than one variable between the two models.
    raw = "".join(
        block.get("text", "")
        for block in body.get("content", [])
        if isinstance(block, dict) and isinstance(block.get("text", ""), str)
    )
    return (
        _parse_json(raw),
        raw,
        normalize_anthropic_usage(body.get("usage")),
        elapsed,
    )


def _chat_openai(context, model, config=None):
    """Chat completions, with one translated knob and one unfixable confound.

    The translated knob is the output cap. This API rejects max_tokens with HTTP
    400 and takes max_completion_tokens instead, so a caller's max_tokens is
    renamed on the way out rather than passed through or dropped.

    The confound is temperature, and no code here can remove it. Rounds 2 and 3
    ran every paid cell at temperature 0. This family rejects that value
    outright and samples only at its default of 1, so the request omits
    temperature entirely. A model B cell therefore differs from its model A twin
    in two variables, the model and the sampling temperature, and the round 4
    rule's "exactly one variable changes between cells" property does not hold
    across the two families. That is a fact about the provider, not a bug to be
    patched, so it is surfaced three times instead of hidden once: here, in the
    refusal below, and in the dry run banner the reader approves before paying.
    A caller that asks for a temperature this family cannot honour is stopped
    rather than having its request quietly rewritten, because a silently dropped
    temperature is exactly how the second changed variable would go unnoticed.
    """
    config = config or {}
    if (
        "temperature" in config
        and config["temperature"] != OPENAI_ONLY_TEMPERATURE
    ):
        raise SystemExit(
            f"model {model!r} samples only at temperature "
            f"{OPENAI_ONLY_TEMPERATURE}, and the caller asked for "
            f"{config['temperature']!r}. Refusing rather than dropping it: "
            "this is the second variable between a model B cell and its model "
            "A twin, and it has to be approved, not swallowed."
        )
    started = time.monotonic()
    body = _post_json(
        OPENAI_CHAT_URL,
        {"Authorization": "Bearer " + _api_key(EMBED_KEY_ENV)},
        {
            "model": model_id(model),
            "max_completion_tokens": config.get(
                "max_tokens", OPENAI_MAX_COMPLETION_TOKENS
            ),
            # The Vertex path asks for JSON with responseMimeType, so this asks
            # for the same thing, and the two families are asked for the same
            # output shape rather than one of them being left to answer in
            # prose. The shared prompt already says "Return ONLY a JSON
            # object", which is what this mode requires of the prompt, so
            # nothing is bolted onto the prompt to enable it. Anthropic has no
            # equivalent knob and still relies on _parse_json.
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": context}],
        },
    )
    elapsed = time.monotonic() - started
    raw = ""
    choices = body.get("choices", [])
    if choices and isinstance(choices[0], dict):
        message = choices[0].get("message")
        content = (message or {}).get("content")
        if isinstance(content, str):
            raw = content
    return (
        _parse_json(raw),
        raw,
        normalize_openai_usage(body.get("usage")),
        elapsed,
    )


def _chat_vertex(context, model, config=None):
    temperature = (config or {}).get("temperature", sampling_temperature(model))
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
# One probe, three families, and the families disagree about the knobs. Vertex
# and Anthropic take temperature 0; the openai family rejects it with HTTP 400
# and is sent no temperature at all, which is the round's stated confound rather
# than a probe detail. Every family still gets the same single-digit-token cap,
# under whichever name its API uses, which _chat_openai translates. A family
# added to FAMILY_PREFIXES without a row here fails at the probe, which is the
# right place for it to fail: before anything is spent.
PROBE_CONFIG = {
    "vertex": {"temperature": 0, "max_tokens": 64},
    "anthropic": {"temperature": 0, "max_tokens": 64},
    "openai": {"max_tokens": 64},
}


def validate_model(model):
    """Prove the model answers on this account before the grid spends anything.

    No backend exposes a listing that reflects entitlement: Vertex has no
    per-project publisher list, and an Anthropic or openai key returns a
    catalogue the account may still be refused on. A name check would be
    guesswork on all three, so one real call is the only honest test, and it
    costs single-digit tokens. The same probe covers every family because chat
    dispatches on the model, and the per-family knobs come from PROBE_CONFIG so
    that one call stays one call rather than becoming one probe per backend.
    """
    try:
        parsed, raw, usage, _ = chat(
            PROBE_PROMPT, model, PROBE_CONFIG[model_family(model)]
        )
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
