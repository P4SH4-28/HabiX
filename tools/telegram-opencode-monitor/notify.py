import argparse
import json
import os
import sys
import urllib.error
import urllib.request

TOKEN_KEY = "TELEGRAM_BOT_TOKEN"
CHAT_KEY = "TELEGRAM_CHAT_ID"
API_HOST = "https://api.telegram.org"

_reg_cache = None
_dotenv_cache = None
_dotenv_mtime = None


def _env_path():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def _reg_env():
    global _reg_cache
    if _reg_cache is not None:
        return _reg_cache
    env = {}
    if os.name == "nt":
        import winreg

        targets = (
            (winreg.HKEY_CURRENT_USER, r"Environment"),
            (
                winreg.HKEY_LOCAL_MACHINE,
                r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
            ),
        )
        for hive, path in targets:
            try:
                with winreg.OpenKey(hive, path) as key:
                    i = 0
                    while True:
                        try:
                            name, val, typ = winreg.EnumValue(key, i)
                        except OSError:
                            break
                        if typ == winreg.REG_EXPAND_SZ:
                            val = os.path.expandvars(val)
                        env.setdefault(name, str(val))
                        i += 1
            except OSError:
                continue
    _reg_cache = env
    return env


def _dotenv():
    global _dotenv_cache, _dotenv_mtime
    path = _env_path()
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        mtime = None
    if _dotenv_cache is not None and mtime == _dotenv_mtime:
        return _dotenv_cache
    vals = {}
    try:
        with open(path, "r", encoding="utf-8-sig") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                    val = val[1:-1]
                vals[key.strip()] = val
    except OSError:
        pass
    _dotenv_cache = vals
    _dotenv_mtime = mtime
    return vals


def get_secret(name):
    val = os.environ.get(name)
    if val and val.strip():
        return val.strip()
    val = _reg_env().get(name)
    if val and val.strip():
        return val.strip()
    val = _dotenv().get(name)
    if val and val.strip():
        return val.strip()
    return None


def secrets():
    return get_secret(TOKEN_KEY), get_secret(CHAT_KEY)


def mask(text):
    if text is None:
        return ""
    out = str(text)
    token = get_secret(TOKEN_KEY)
    if token and len(token) >= 8:
        out = out.replace(token, "***TOKEN***")
    chat = get_secret(CHAT_KEY)
    if chat and len(chat) >= 5:
        out = out.replace(chat, "***CHAT_ID***")
    return out


def _api_post(method, payload, timeout=15):
    token, _ = secrets()
    if not token:
        return False, "config", "%s tanimli degil" % TOKEN_KEY
    url = "%s/bot%s/%s" % (API_HOST, token, method)
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            status = resp.getcode()
    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            raw = exc.read().decode("utf-8", "replace")
        except Exception:
            raw = ""
    except Exception as exc:
        return False, "net", mask(exc)
    try:
        data = json.loads(raw)
    except Exception:
        return False, status, mask("telegram yaniti okunamadi (http %s)" % status)
    if not data.get("ok"):
        return False, status, mask(str(data.get("description") or ("http %s" % status)))
    return True, status, data.get("result")


def mask_tail(value, keep=4):
    text = str(value)
    if len(text) <= keep:
        return "*" * len(text)
    return "*" * (len(text) - keep) + text[-keep:]


def learn_chat(write=True):
    global _dotenv_cache, _dotenv_mtime
    ok, status, result = _api_post("getUpdates", {})
    if not ok:
        return False, "FAIL http=%s %s" % (status, mask(result))
    chats = []
    for upd in result or []:
        msg = upd.get("message") or upd.get("channel_post") or upd.get("edited_message")
        if not msg:
            continue
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid is None:
            continue
        chats.append(
            (
                upd.get("update_id") or 0,
                cid,
                chat.get("type") or "?",
                str(chat.get("title") or chat.get("first_name") or ""),
            )
        )
    if not chats:
        return False, "FAIL guncelleme yok: botu acip /start gonderin, sonra tekrar deneyin"
    _, cid, ctype, title = sorted(chats)[-1]
    masked = mask_tail(cid)
    if write:
        env_path = _env_path()
        lines = []
        try:
            with open(env_path, "r", encoding="utf-8-sig") as fh:
                lines = fh.read().splitlines()
        except OSError:
            lines = []
        new_line = "%s=%s" % (CHAT_KEY, cid)
        replaced = False
        for i, line in enumerate(lines):
            if line.strip().startswith(CHAT_KEY + "="):
                lines[i] = new_line
                replaced = True
                break
        if not replaced:
            if lines and lines[-1].strip():
                lines.append("")
            lines.append(new_line)
        with open(env_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
        _dotenv_cache = None
        _dotenv_mtime = None
    return True, "PASS chat=%s tur=%s %s %s" % (
        masked,
        ctype,
        title[:20],
        ".env guncellendi" if write else "",
    )


def send_message(text, parse_mode="HTML", timeout=15):
    token, chat = secrets()
    if not token:
        return False, "config", "%s tanimli degil" % TOKEN_KEY
    if not chat:
        return False, "config", "%s tanimli degil" % CHAT_KEY
    url = "%s/bot%s/sendMessage" % (API_HOST, token)
    body = {"chat_id": chat, "text": text, "disable_web_page_preview": True}
    if parse_mode:
        body["parse_mode"] = parse_mode
    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    status = None
    raw = ""
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.getcode()
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        status = exc.code
        try:
            raw = exc.read().decode("utf-8", "replace")
        except Exception:
            raw = ""
    except Exception as exc:
        return False, "net", mask(exc)
    try:
        data = json.loads(raw)
    except Exception:
        return False, status, mask("telegram yaniti okunamadi (http %s)" % status)
    if not data.get("ok"):
        desc = str(data.get("description") or "")
        return False, status, mask(desc or ("http %s" % status))
    result = data.get("result") or {}
    mid = result.get("message_id")
    return True, status, ("message_id=%s" % mid) if mid is not None else "ok"


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--text")
    parser.add_argument("--plain", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--learn-chat", action="store_true")
    args = parser.parse_args(argv)

    token, chat = secrets()
    if args.check:
        print(
            "token_configured=%s chat_configured=%s"
            % ("yes" if token else "no", "yes" if chat else "no")
        )
        return 0 if (token and chat) else 2
    if args.learn_chat:
        ok, info = learn_chat(write=True)
        print(mask(info))
        return 0 if ok else 1
    if not args.text:
        print("FAIL config=mesaj (--text) belirtilmedi")
        return 2
    if args.dry_run:
        print("DRY-RUN metin_uzunluk=%d" % len(args.text))
        return 0
    ok, status, info = send_message(
        args.text, parse_mode=(None if args.plain else "HTML")
    )
    info = mask(info)
    if ok:
        print("PASS http=%s %s" % (status, info))
        return 0
    if status == "config":
        print("FAIL config=%s" % info)
        return 2
    print("FAIL http=%s %s" % (status, info))
    return 1


if __name__ == "__main__":
    sys.exit(main())
