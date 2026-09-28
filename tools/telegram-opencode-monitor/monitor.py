import argparse
import datetime
import html as html_module
import json
import os
import re
import sqlite3
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import notify

STATE_DIR = os.path.join(HERE, "state")
STATE_FILE = os.path.join(STATE_DIR, "state.json")
LOG_FILE = os.path.join(STATE_DIR, "monitor.log")
PID_FILE = os.path.join(STATE_DIR, "monitor.pid")
LOCK_FILE = os.path.join(STATE_DIR, "monitor.lock")

DB_PATH = os.environ.get("OPENCODE_DB") or os.path.join(
    os.path.expanduser("~"), ".local", "share", "opencode", "opencode.db"
)

DEFAULT_INTERVAL = 10
MIN_INTERVAL = 5
MAX_INTERVAL = 60
ACTIVE_WINDOW_MS = 60 * 1000
STUCK_MS = 15 * 60 * 1000
TOOL_WINDOW_MS = 60 * 60 * 1000
LONG_MINUTES = [30, 60, 120, 240]
SESSION_CUTOFF_MS = 24 * 60 * 60 * 1000
MAX_SESSIONS = 12
RETRY_AFTER_MS = 5 * 60 * 1000
RETRY_GIVEUP_MS = 30 * 60 * 1000
EXIT_PROJECT_WINDOW_MS = 6 * 60 * 60 * 1000
START_PROJECT_WINDOW_MS = 10 * 60 * 1000


def now_ms():
    return int(time.time() * 1000)


def esc(value):
    return html_module.escape(str(value), quote=False)


def fmt_dur(ms):
    secs = max(0, int(ms) // 1000)
    if secs < 60:
        return "%d sn" % secs
    mins = secs // 60
    if mins < 60:
        return "%d dk" % mins
    hours = mins // 60
    if hours < 24:
        return "%d sa %d dk" % (hours, mins % 60)
    return "%d gun %d sa" % (hours // 24, hours % 24)


def project_name(directory):
    if not directory:
        return "Bilinmiyor"
    norm = str(directory).replace("\\", "/").rstrip("/")
    leaf = norm.rsplit("/", 1)[-1]
    if "habitracker" in leaf.lower():
        return "HabitTracker"
    return leaf or "Bilinmiyor"


def log(message, level="INFO"):
    line = "%s [%s] %s" % (
        datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        level,
        notify.mask(message),
    )
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 1000000:
            os.replace(LOG_FILE, LOG_FILE + ".1")
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def load_state():
    fresh = {
        "version": 1,
        "process": {"initialized": False, "running": False, "observed_since": None},
        "sessions": {},
        "perm_notified": [],
        "pending": [],
    }
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            fresh.update(data)
            return fresh
    except (OSError, ValueError):
        pass
    if os.path.exists(STATE_FILE):
        try:
            os.replace(STATE_FILE, STATE_FILE + ".bad")
            log("bozuk state dosyasi yedeklendi", "WARN")
        except OSError:
            pass
    return fresh


def save_state(state):
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(state, fh, ensure_ascii=False, sort_keys=True)
        os.replace(tmp, STATE_FILE)
    except OSError as exc:
        log("state kaydedilemedi: %s" % notify.mask(exc), "WARN")


def acquire_lock():
    os.makedirs(STATE_DIR, exist_ok=True)
    try:
        fh = open(LOCK_FILE, "a+")
    except OSError:
        return None
    try:
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        return None
    return fh


def detect_processes():
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    try:
        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq opencode.exe", "/NH", "/FO", "CSV"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=flags,
        ).stdout or ""
    except Exception:
        return []
    pids = []
    for line in out.splitlines():
        match = re.match(r'"opencode\.exe"\s*,\s*"(\d+)"', line.strip(), re.IGNORECASE)
        if match:
            pids.append(int(match.group(1)))
    return pids


def db_snapshot(now):
    sessions = []
    permissions = []
    uri = "file:%s?mode=ro" % os.path.abspath(DB_PATH).replace("\\", "/")
    con = sqlite3.connect(uri, uri=True, timeout=5)
    try:
        cur = con.cursor()
        cutoff = now - SESSION_CUTOFF_MS
        rows = cur.execute(
            "select id, directory, title, time_created, time_updated from session "
            "where parent_id is null and time_updated > ? "
            "order by time_updated desc limit ?",
            (cutoff, MAX_SESSIONS),
        ).fetchall()
        for sid, directory, title, t_created, t_updated in rows:
            part_act = (
                cur.execute(
                    "select max(time_updated) from part where session_id=?", (sid,)
                ).fetchone()[0]
                or 0
            )
            msg_row = cur.execute(
                "select id, data, time_created from message "
                "where session_id=? order by time_created desc limit 1",
                (sid,),
            ).fetchone()
            last_msg = None
            msg_act = 0
            if msg_row:
                try:
                    data = json.loads(msg_row[1])
                except ValueError:
                    data = {}
                times = data.get("time") or {}
                created = times.get("created") or msg_row[2] or 0
                completed = times.get("completed")
                last_msg = {
                    "id": msg_row[0],
                    "role": data.get("role"),
                    "created": created,
                    "completed": completed,
                }
                msg_act = max(created, completed or 0)
            running_tools = 0
            running_tool_time = 0
            errors = []
            tool_window = now - TOOL_WINDOW_MS
            tool_rows = cur.execute(
                "select time_updated, data from part "
                "where session_id=? and time_updated > ?",
                (sid, tool_window),
            ).fetchall()
            for part_time, part_data in tool_rows:
                try:
                    pj = json.loads(part_data)
                except ValueError:
                    continue
                if pj.get("type") != "tool":
                    continue
                state = pj.get("state") or {}
                status = state.get("status")
                if status in ("running", "pending"):
                    running_tools += 1
                    running_tool_time = max(running_tool_time, part_time)
                if status == "error" or state.get("error"):
                    err = state.get("error")
                    msg = ""
                    if isinstance(err, dict):
                        msg = str(err.get("name") or err.get("message") or err)[:160]
                    elif err:
                        msg = str(err)[:160]
                    errors.append(
                        {
                            "time": part_time,
                            "tool": str(pj.get("tool") or ""),
                            "msg": msg,
                        }
                    )
            todos = dict(
                cur.execute(
                    "select status, count(*) from todo where session_id=? group by status",
                    (sid,),
                ).fetchall()
            )
            activity = max(t_updated or 0, part_act, msg_act)
            sessions.append(
                {
                    "id": sid,
                    "directory": directory,
                    "project": project_name(directory),
                    "time_created": t_created or 0,
                    "activity": activity,
                    "last_msg": last_msg,
                    "running_tools": running_tools,
                    "running_tool_time": running_tool_time,
                    "errors": errors,
                    "todos": todos,
                }
            )
        try:
            prows = cur.execute(
                "select p.action, p.resource, pr.worktree from permission p "
                "left join project pr on pr.id = p.project_id"
            ).fetchall()
        except sqlite3.Error:
            prows = []
        for action, resource, worktree in prows:
            permissions.append(
                {
                    "action": action or "",
                    "resource": resource or "",
                    "worktree": worktree or "",
                }
            )
    finally:
        con.close()
    return {"sessions": sessions, "permissions": permissions}


def derive_active(cur, now, proc_alive):
    if not proc_alive:
        return False
    if (now - cur.get("activity", 0)) <= ACTIVE_WINDOW_MS:
        return True
    if cur.get("running_tools") and (
        now - cur.get("running_tool_time", 0)
    ) <= TOOL_WINDOW_MS:
        return True
    lm = cur.get("last_msg")
    if lm:
        if lm.get("role") == "assistant" and not lm.get("completed"):
            anchor = max(lm.get("created") or 0, cur.get("activity", 0))
            return (now - anchor) <= STUCK_MS
        if lm.get("role") == "user":
            return (now - (lm.get("created") or cur.get("activity", 0))) <= STUCK_MS
    return False


def decide_turn(cur, now, turn_start):
    errs = [e for e in cur.get("errors") or [] if e.get("time", 0) >= turn_start]
    if errs:
        errs.sort(key=lambda e: e.get("time", 0), reverse=True)
        err = errs[0]
        summary = "%s: %s" % (err.get("tool") or "tool", err.get("msg") or "")
        return "error", summary.strip(": ")
    lm = cur.get("last_msg")
    if lm and lm.get("role") == "assistant" and lm.get("completed"):
        todos = cur.get("todos") or {}
        total = sum(todos.values())
        done = todos.get("completed", 0)
        if total > 0 and done == total:
            return "completed", (done, total)
        return "input", (done, total)
    return None, None


def session_step(prev, cur, now, proc_alive, perm_pending):
    events = []
    active = derive_active(cur, now, proc_alive)
    if prev is None:
        new = {
            "project": cur["project"],
            "state": "active" if active else "idle",
            "turn_start": now,
            "time_created": cur["time_created"],
            "last_seen": now,
            "notified_turn": None,
            "notified_long": [
                th
                for th in LONG_MINUTES
                if (now - cur["time_created"]) >= th * 60000
            ],
        }
        return new, events
    new = dict(prev)
    new["project"] = cur["project"]
    new["time_created"] = cur["time_created"]
    new["last_seen"] = now
    prev_state = prev.get("state")
    if active:
        new["state"] = "active"
        if prev_state != "active":
            new["turn_start"] = now
        else:
            elapsed = now - cur["time_created"]
            notified = list(prev.get("notified_long") or [])
            for th in LONG_MINUTES:
                if elapsed >= th * 60000 and th not in notified:
                    notified.append(th)
                    events.append(
                        {"type": "long", "project": cur["project"], "minutes": th}
                    )
            new["notified_long"] = notified
        return new, events
    new["state"] = "idle"
    if prev_state != "active":
        return new, events
    turn_start = prev.get("turn_start") or now
    kind, detail = (None, None)
    if not perm_pending:
        kind, detail = decide_turn(cur, now, turn_start)
    lm = cur.get("last_msg") or {}
    turn_key = lm.get("id") or str(cur.get("activity", now))
    if kind and prev.get("notified_turn") != turn_key:
        event = {
            "type": kind,
            "project": cur["project"],
            "duration": fmt_dur(now - cur["time_created"]),
        }
        if kind in ("completed", "input"):
            event["todos"] = detail
        elif kind == "error":
            event["error"] = detail
        events.append(event)
        new["notified_turn"] = turn_key
    else:
        new["notified_turn"] = prev.get("notified_turn")
    return new, events


def permission_events(perms, notified_keys, sessions):
    if not perms:
        return [], []
    keys = []
    samples = {}
    for perm in perms:
        if perm.get("worktree"):
            key = project_name(perm["worktree"])
        elif sessions:
            key = sessions[0]["project"]
        else:
            key = "Bilinmiyor"
        keys.append(key)
        samples.setdefault(key, perm)
    events = []
    for key in sorted(set(keys)):
        if key in notified_keys:
            continue
        perm = samples[key]
        resource = str(perm.get("resource") or "").replace("\\", "/")
        if len(resource) > 60:
            resource = "..." + resource[-57:]
        events.append(
            {
                "type": "permission",
                "project": key,
                "action": perm.get("action") or "",
                "resource": resource,
            }
        )
    return events, sorted(set(notified_keys) | set(keys))


def pick_project(sessions, now, window_ms):
    projects = sorted(
        {s["project"] for s in sessions if (now - s.get("activity", 0)) <= window_ms}
    )
    return ", ".join(projects) if projects else None


def build_exit_event(state, sessions, now, proc_meta):
    projects = sorted(
        {
            s["project"]
            for s in sessions
            if (now - s.get("activity", 0)) <= EXIT_PROJECT_WINDOW_MS
        }
    )
    active_recent = [
        s for s in sessions if (now - s.get("activity", 0)) <= 60 * 60000
    ]
    base = None
    if active_recent:
        stamps = [s.get("time_created") for s in active_recent if s.get("time_created")]
        if stamps:
            base = min(stamps)
    if not base:
        base = proc_meta.get("observed_since") or now
    details = []
    for session in sessions:
        st = (state.get("sessions") or {}).get(session["id"])
        if not st or st.get("state") != "active":
            continue
        kind, detail = decide_turn(session, now, st.get("turn_start") or now)
        if kind == "completed" and detail:
            status = "son durum: tamamlandı (%d/%d tamam)" % detail
        elif kind == "error":
            status = "son durum: hata"
        elif kind == "input":
            status = "son durum: iş turu bitti, girdi bekliyordu"
        else:
            status = "aktifken kapandı (durum doğrulanamadı)"
        details.append({"project": session["project"], "status": status})
    return {
        "type": "exit",
        "project": ", ".join(projects) if projects else None,
        "duration": fmt_dur(now - base),
        "details": details,
    }


def render(ev):
    kind = ev.get("type")
    demo = "<b>DEMO</b> — " if ev.get("demo") else ""
    project = ev.get("project")
    folder = "📁 %s" % esc(project) if project else None
    lines = []
    if kind == "started":
        lines.append(demo + "🟢 <b>OpenCode başladı</b>")
        if folder:
            lines.extend(["", folder])
    elif kind == "completed":
        lines.append(demo + "🟢 <b>OpenCode görevi tamamlandı</b>")
        lines.append("")
        if folder:
            lines.append(folder)
        if ev.get("duration"):
            lines.append("⏱️ Süre: %s" % esc(ev["duration"]))
        todos = ev.get("todos")
        if todos and todos[1] > 0:
            lines.append("✅ Yapılacaklar: %d/%d tamam" % todos)
    elif kind == "input":
        lines.append(demo + "🟡 <b>OpenCode kullanıcı girdisi bekliyor</b>")
        lines.append("")
        if folder:
            lines.append(folder)
        if ev.get("duration"):
            lines.append("⏱️ Süre: %s" % esc(ev["duration"]))
        todos = ev.get("todos")
        if todos and todos[1] > 0:
            lines.append("✅ Yapılacaklar: %d/%d tamam" % todos)
        lines.append("💬 Devam etmek için terminal yanıtı bekleniyor")
    elif kind == "permission":
        lines.append(demo + "🟡 <b>OpenCode izin bekliyor</b>")
        lines.append("")
        if folder:
            lines.append(folder)
        parts = [p for p in (ev.get("action"), ev.get("resource")) if p]
        if parts:
            lines.append("🔐 %s" % esc(" — ".join(parts)))
        lines.append("⚠️ Onay OpenCode terminalinde bekliyor")
    elif kind == "error":
        lines.append(demo + "🔴 <b>OpenCode hata verdi</b>")
        lines.append("")
        if folder:
            lines.append(folder)
        if ev.get("duration"):
            lines.append("⏱️ Süre: %s" % esc(ev["duration"]))
        if ev.get("error"):
            lines.append("❌ %s" % esc(ev["error"]))
    elif kind == "long":
        lines.append(demo + "⏳ <b>OpenCode hâlâ çalışıyor</b>")
        lines.append("")
        if folder:
            lines.append(folder)
        lines.append("⏱️ Süre: %d dakika" % int(ev.get("minutes") or 0))
    elif kind == "exit":
        lines.append(demo + "⚪ <b>OpenCode oturumu kapandı</b>")
        lines.append("")
        if folder:
            lines.append(folder)
        if ev.get("duration"):
            lines.append("⏱️ Süre: %s" % esc(ev["duration"]))
        for detail in ev.get("details") or []:
            lines.append(
                "⚠️ %s: %s" % (esc(detail.get("project")), esc(detail.get("status")))
            )
    else:
        lines.append(demo + "OpenCode olayı: %s" % esc(kind))
    return "\n".join(lines)


def flush(state, events, now, dry_run):
    for event in events:
        log(
            "olay type=%s project=%s"
            % (event.get("type"), event.get("project") or "-")
        )
        if dry_run:
            print("[DRY-RUN] %s" % event.get("type"))
            continue
        text = render(event)
        ok, status, info = notify.send_message(text)
        if ok:
            log("gonderildi type=%s http=%s" % (event.get("type"), status))
        else:
            log(
                "gonderim hatasi type=%s http=%s %s"
                % (event.get("type"), status, notify.mask(info)),
                "WARN",
            )
            pending = state.setdefault("pending", [])
            if len(pending) < 10:
                pending.append(
                    {
                        "type": event.get("type"),
                        "text": text,
                        "occurred_at": now,
                        "last_attempt": now,
                        "attempts": 1,
                    }
                )
    if dry_run:
        return events
    keep = []
    for item in state.get("pending") or []:
        if now - item.get("occurred_at", 0) > RETRY_GIVEUP_MS:
            log("bekletilen bildirim vesi gecti type=%s" % item.get("type"), "WARN")
            continue
        if now - item.get("last_attempt", 0) >= RETRY_AFTER_MS:
            ok, status, info = notify.send_message(item["text"])
            if ok:
                log(
                    "bekletilen bildirim gonderildi type=%s"
                    % item.get("type")
                )
                continue
            item["last_attempt"] = now
            item["attempts"] = item.get("attempts", 0) + 1
            log(
                "bekletilen bildirim hatasi type=%s http=%s"
                % (item.get("type"), status),
                "WARN",
            )
        keep.append(item)
    state["pending"] = keep
    return events


def run_cycle(state, now, dry_run=False):
    procs = detect_processes()
    proc_alive = bool(procs)
    try:
        snap = db_snapshot(now)
    except Exception as exc:
        log("db snapshot hatasi: %s" % notify.mask(exc), "WARN")
        snap = None
    sessions = snap["sessions"] if snap else []
    perms = snap["permissions"] if snap else []
    pstate = state.setdefault(
        "process", {"initialized": False, "running": False, "observed_since": None}
    )
    sstate = state.setdefault("sessions", {})
    events = []
    cold = not pstate.get("initialized")
    exit_cycle = (not cold) and pstate.get("running") and not proc_alive
    start_cycle = (not cold) and (not pstate.get("running")) and proc_alive

    if cold:
        for session in sessions:
            st, evs = session_step(None, session, now, proc_alive, bool(perms))
            sstate[session["id"]] = st
            events.extend(evs)
        pstate["initialized"] = True
        pstate["running"] = proc_alive
        if proc_alive:
            pstate["observed_since"] = now
            events.append(
                {
                    "type": "started",
                    "project": pick_project(sessions, now, START_PROJECT_WINDOW_MS),
                }
            )
    elif exit_cycle:
        for session in sessions:
            st = sstate.get(session["id"])
            if st:
                st["state"] = "idle"
        events.append(build_exit_event(state, sessions, now, pstate))
        pstate["running"] = False
        pstate["observed_since"] = None
    elif start_cycle:
        pstate["running"] = True
        pstate["observed_since"] = now
        events.append(
            {
                "type": "started",
                "project": pick_project(sessions, now, START_PROJECT_WINDOW_MS),
            }
        )
        for session in sessions:
            st, evs = session_step(
                sstate.get(session["id"]), session, now, True, bool(perms)
            )
            sstate[session["id"]] = st
            events.extend(evs)
    elif proc_alive:
        for session in sessions:
            st, evs = session_step(
                sstate.get(session["id"]), session, now, True, bool(perms)
            )
            sstate[session["id"]] = st
            events.extend(evs)

    if proc_alive:
        pevents, new_keys = permission_events(
            perms, state.get("perm_notified") or [], sessions
        )
        events.extend(pevents)
        state["perm_notified"] = new_keys
    else:
        state["perm_notified"] = []

    known = {s["id"] for s in sessions}
    for sid in [k for k in sstate if k not in known]:
        if now - (sstate[sid].get("last_seen") or 0) > SESSION_CUTOFF_MS:
            del sstate[sid]

    return flush(state, events, now, dry_run)


def pid_alive(pid):
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
    for image in ("python.exe", "pythonw.exe", "python3.exe"):
        try:
            out = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq %s" % image, "/NH", "/FO", "CSV"],
                capture_output=True,
                text=True,
                timeout=10,
                creationflags=flags,
            ).stdout or ""
        except Exception:
            continue
        for line in out.splitlines():
            match = re.match(
                r'"%s"\s*,\s*"(\d+)"' % re.escape(image), line.strip(), re.IGNORECASE
            )
            if match and int(match.group(1)) == int(pid):
                return True
    return False


def monitor_pid():
    try:
        with open(PID_FILE, "r", encoding="utf-8") as fh:
            pid = int(fh.read().strip())
    except (OSError, ValueError):
        return None
    return pid if pid and pid != os.getpid() and pid_alive(pid) else None


def cmd_status():
    token, chat = notify.secrets()
    print("=== Telegram ===")
    print("token_configured: %s" % ("yes" if token else "no"))
    print("chat_configured:  %s" % ("yes" if chat else "no"))
    print("=== OpenCode ===")
    print("db: %s (%s)" % (DB_PATH, "var" if os.path.isfile(DB_PATH) else "YOK"))
    procs = detect_processes()
    print(
        "opencode prosesleri: %d%s"
        % (
            len(procs),
            (" pid=" + ",".join(str(p) for p in procs)) if procs else "",
        )
    )
    pid = monitor_pid()
    print("monitor: %s" % ("calisiyor (pid %s)" % pid if pid else "calismiyor"))
    state = load_state()
    print(
        "state: %s (son guncelleme %s)"
        % (
            STATE_FILE,
            datetime.datetime.fromtimestamp(os.path.getmtime(STATE_FILE))
            if os.path.exists(STATE_FILE)
            else "yok",
        )
    )
    print("=== Oturumlar ===")
    try:
        snap = db_snapshot(now_ms())
    except Exception as exc:
        print("db okunamadi: %s" % notify.mask(exc))
        snap = {"sessions": [], "permissions": []}
    now = now_ms()
    if not snap["sessions"]:
        print("(son 24 saatte guncellenmis ust-duzey oturum yok)")
    for session in snap["sessions"]:
        st = (state.get("sessions") or {}).get(session["id"]) or {}
        lm = session.get("last_msg") or {}
        print(
            "  %s | %s | durum=%s | aktivite=%s once | son mesaj=%s%s | todos=%s"
            % (
                session["id"][-8:],
                session["project"],
                st.get("state", "bilinmiyor"),
                fmt_dur(now - session["activity"]),
                lm.get("role") or "-",
                "" if lm.get("completed") else " (tamamlanmadi)",
                session.get("todos") or {},
            )
        )
    if snap["permissions"]:
        print("izin bekleyen: %d" % len(snap["permissions"]))
    else:
        print("izin bekleyen: 0")
    return 0


DEMO_EVENTS = {
    "started": {"type": "started", "project": "HabitTracker"},
    "completed": {
        "type": "completed",
        "project": "HabitTracker",
        "duration": "23 dk",
        "todos": (6, 6),
    },
    "input": {
        "type": "input",
        "project": "HabitTracker",
        "duration": "12 dk",
        "todos": (56, 67),
    },
    "permission": {
        "type": "permission",
        "project": "HabitTracker",
        "action": "edit",
        "resource": "src/screens/HomeScreen.tsx",
    },
    "error": {
        "type": "error",
        "project": "HabitTracker",
        "duration": "8 dk",
        "error": "bash: pytest basarisiz (exit 1)",
    },
    "long": {"type": "long", "project": "HabitTracker", "minutes": 30},
    "exit": {
        "type": "exit",
        "project": "HabitTracker, KPLN",
        "duration": "5 sa 12 dk",
        "details": [
            {
                "project": "HabitTracker",
                "status": "aktifken kapandı (durum doğrulanamadı)",
            }
        ],
    },
}


def cmd_demo(kind):
    template = DEMO_EVENTS.get(kind)
    if not template:
        print("FAIL demo tipi gecersiz: %s" % kind)
        return 2
    event = dict(template)
    event["demo"] = True
    text = render(event)
    ok, status, info = notify.send_message(text)
    if ok:
        print("PASS demo=%s http=%s %s" % (kind, status, notify.mask(info)))
        return 0
    print("FAIL demo=%s http=%s %s" % (kind, status, notify.mask(info)))
    return 2 if status == "config" else 1


def mk_cur(**kwargs):
    base = {
        "id": "ses_test0001",
        "directory": "C:/Users/KPLN/Desktop/HabitTracker",
        "project": "HabitTracker",
        "time_created": 0,
        "activity": 0,
        "last_msg": None,
        "running_tools": 0,
        "running_tool_time": 0,
        "errors": [],
        "todos": {},
    }
    base.update(kwargs)
    return base


def self_test():
    results = []
    now = 1790000000000

    def check(name, condition, detail=""):
        results.append((name, bool(condition), detail))

    cur_active = mk_cur(
        time_created=now - 25 * 60000,
        activity=now - 5000,
        last_msg={"id": "m2", "role": "assistant", "created": now - 20000, "completed": None},
    )
    st, evs = session_step(None, cur_active, now, True, False)
    check("baseline_aktif_sessiz", st["state"] == "active" and not evs)

    cur_idle = mk_cur(
        time_created=now - 45 * 60000,
        activity=now - 200000,
        last_msg={"id": "m9", "role": "assistant", "created": now - 210000, "completed": now - 200000},
    )
    st, evs = session_step(None, cur_idle, now, True, False)
    check(
        "baseline_idle_sessiz_ve_long_on_isaretleme",
        st["state"] == "idle"
        and not evs
        and 30 in st["notified_long"]
        and 60 not in st["notified_long"],
        "notified_long=%s" % st.get("notified_long"),
    )

    prev = {
        "project": "HabitTracker",
        "state": "active",
        "turn_start": now - 100000,
        "time_created": now - 18 * 60000,
        "last_seen": now - 10000,
        "notified_turn": None,
        "notified_long": [],
    }
    cur_done = mk_cur(
        time_created=now - 18 * 60000,
        activity=now - 120000,
        last_msg={"id": "mA", "role": "assistant", "created": now - 130000, "completed": now - 120000},
        todos={"completed": 56, "in_progress": 5, "pending": 6},
    )
    st, evs = session_step(dict(prev), cur_done, now, True, False)
    check(
        "turn_input_karari",
        len(evs) == 1 and evs[0]["type"] == "input" and st["state"] == "idle",
        "events=%s" % [e.get("type") for e in evs],
    )

    cur_all_done = mk_cur(
        time_created=now - 18 * 60000,
        activity=now - 120000,
        last_msg={"id": "mB", "role": "assistant", "created": now - 130000, "completed": now - 120000},
        todos={"completed": 6},
    )
    st, evs = session_step(dict(prev), cur_all_done, now, True, False)
    check(
        "turn_completed_karari",
        len(evs) == 1
        and evs[0]["type"] == "completed"
        and evs[0]["todos"] == (6, 6),
        "events=%s" % [e.get("type") for e in evs],
    )

    cur_err = mk_cur(
        time_created=now - 18 * 60000,
        activity=now - 120000,
        last_msg={"id": "mC", "role": "assistant", "created": now - 130000, "completed": now - 120000},
        todos={"completed": 6},
        errors=[{"time": now - 90000, "tool": "bash", "msg": "exit 1"}],
    )
    st, evs = session_step(dict(prev), cur_err, now, True, False)
    check(
        "turn_error_karari",
        len(evs) == 1 and evs[0]["type"] == "error" and "bash" in evs[0]["error"],
        "events=%s" % [e.get("type") for e in evs],
    )

    ended = dict(prev)
    ended["state"] = "idle"
    ended["notified_turn"] = "mA"
    st, evs = session_step(ended, cur_done, now, True, False)
    check("tekrar_bildirim_yok", not evs, "events=%s" % [e.get("type") for e in evs])

    cur_think = mk_cur(
        time_created=now - 25 * 60000,
        activity=now - 5 * 60000,
        last_msg={"id": "mD", "role": "assistant", "created": now - 5 * 60000, "completed": None},
    )
    st, evs = session_step(dict(prev), cur_think, now, True, False)
    check(
        "dusunme_sirasinda_yanlis_pozitif_yok",
        st["state"] == "active" and not evs,
        "state=%s events=%s" % (st["state"], [e.get("type") for e in evs]),
    )

    cur_stuck = mk_cur(
        time_created=now - 40 * 60000,
        activity=now - 20 * 60000,
        last_msg={"id": "mE", "role": "assistant", "created": now - 20 * 60000, "completed": None},
    )
    st, evs = session_step(dict(prev), cur_stuck, now, True, False)
    check(
        "sikismis_oturum_sessiz",
        st["state"] == "idle" and not evs,
        "state=%s events=%s" % (st["state"], [e.get("type") for e in evs]),
    )

    cur_long = mk_cur(
        time_created=now - 31 * 60000,
        activity=now - 5000,
        last_msg={"id": "mF", "role": "assistant", "created": now - 10000, "completed": None},
    )
    st, evs = session_step(dict(prev), cur_long, now, True, False)
    check(
        "long_30_dk_bir_kez",
        len(evs) == 1 and evs[0]["type"] == "long" and evs[0]["minutes"] == 30,
        "events=%s" % [e.get("type") for e in evs],
    )
    st2, evs2 = session_step(st, cur_long, now + 60000, True, False)
    check(
        "long_tekrar_yok",
        not evs2 and 30 in st2["notified_long"],
        "events=%s" % [e.get("type") for e in evs2],
    )

    perms = [
        {
            "action": "edit",
            "resource": "C:/Users/KPLN/Desktop/HabitTracker/src/app.ts",
            "worktree": "C:/Users/KPLN/Desktop/HabitTracker",
        }
    ]
    pev, keys = permission_events(perms, [], [cur_active])
    check(
        "izin_bildirimi",
        len(pev) == 1 and pev[0]["type"] == "permission" and keys == ["HabitTracker"],
        "events=%s keys=%s" % ([e.get("type") for e in pev], keys),
    )
    pev2, keys2 = permission_events(perms, keys, [cur_active])
    check("izin_tekrar_yok", not pev2 and keys2 == ["HabitTracker"])
    pev3, keys3 = permission_events([], keys, [cur_active])
    check("izin_temizlenince_sifirlanir", not pev3 and keys3 == [])

    st_perm, evs_perm = session_step(dict(prev), cur_all_done, now, True, True)
    check(
        "izin_varken_turn_end_sessiz",
        not evs_perm and st_perm["state"] == "idle",
        "events=%s" % [e.get("type") for e in evs_perm],
    )

    ev_started = {
        "type": "started",
        "project": "HabitTracker",
    }
    text = render(ev_started)
    check("render_basladi_emoji", "🟢" in text and "HabitTracker" in text)
    ev_bad = {"type": "completed", "project": "A&B <test>", "duration": "5 dk", "todos": (1, 1)}
    text_bad = render(ev_bad)
    check(
        "render_html_escaping",
        "A&amp;B" in text_bad and "<test>" not in text_bad,
        text_bad.replace("\n", " | "),
    )
    for kind in DEMO_EVENTS:
        rendered = render(dict(DEMO_EVENTS[kind]))
        check(
            "render_%s" % kind,
            len(rendered) > 10
            and (
                any(ch in rendered for ch in ("🟢", "🟡", "🔴", "⏳", "⚪"))
            ),
        )

    exit_state = {
        "sessions": {
            "ses_test0001": {
                "state": "active",
                "turn_start": now - 100000,
                "project": "HabitTracker",
            }
        }
    }
    exit_ev = build_exit_event(
        exit_state, [cur_done], now, {"observed_since": now - 5 * 3600000}
    )
    check(
        "exit_olayi_detayli",
        exit_ev["type"] == "exit"
        and exit_ev["project"] == "HabitTracker"
        and len(exit_ev["details"]) == 1
        and "girdi bekliyordu" in exit_ev["details"][0]["status"],
        "ev=%s" % exit_ev,
    )

    global detect_processes, db_snapshot
    orig_detect = detect_processes
    orig_snap = db_snapshot
    try:
        state = {
            "version": 1,
            "process": {"initialized": True, "running": False, "observed_since": None},
            "sessions": {},
            "perm_notified": [],
            "pending": [],
        }
        detect_processes = lambda: [111, 222]
        db_snapshot = lambda n: {"sessions": [], "permissions": []}
        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()):
            evs = run_cycle(state, now, dry_run=True)
        check(
            "surec_baslama_olayi",
            len(evs) == 1 and evs[0]["type"] == "started" and state["process"]["running"],
            "events=%s" % [e.get("type") for e in evs],
        )
        with contextlib.redirect_stdout(io.StringIO()):
            evs = run_cycle(state, now + 10000, dry_run=True)
        check("surec_calisirken_sessiz", not evs, "events=%s" % [e.get("type") for e in evs])
        detect_processes = lambda: []
        with contextlib.redirect_stdout(io.StringIO()):
            evs = run_cycle(state, now + 20000, dry_run=True)
        check(
            "surec_kapanma_olayi",
            len(evs) == 1
            and evs[0]["type"] == "exit"
            and not state["process"]["running"],
            "events=%s" % [e.get("type") for e in evs],
        )
        with contextlib.redirect_stdout(io.StringIO()):
            evs = run_cycle(state, now + 30000, dry_run=True)
        check("kapanma_sonrasi_sessiz", not evs, "events=%s" % [e.get("type") for e in evs])
    finally:
        detect_processes = orig_detect
        db_snapshot = orig_snap

    token, _ = notify.secrets()
    if token:
        probe = "x%sy" % token
        check(
            "secret_masking",
            token not in notify.mask(probe) and "***TOKEN***" in notify.mask(probe),
        )
    else:
        results.append(("secret_masking", True, "SKIP: token tanimli degil"))

    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print("%s %s%s" % ("PASS" if ok else "FAIL", name, (" -- " + detail) if detail and not ok else ""))
    print("---")
    print("%d test, %d FAIL" % (len(results), len(failed)))
    return 1 if failed else 0


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(
        description="OpenCode Telegram monitor"
    )
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--demo", choices=sorted(DEMO_EVENTS.keys()))
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()
    if args.status:
        return cmd_status()
    if args.demo:
        return cmd_demo(args.demo)

    interval = max(MIN_INTERVAL, min(MAX_INTERVAL, args.interval or DEFAULT_INTERVAL))
    os.makedirs(STATE_DIR, exist_ok=True)
    lock = acquire_lock()
    if lock is None:
        print("FAIL monitor zaten calisiyor (kilit dosyasi tutuluyor)")
        return 1
    try:
        if args.once:
            state = load_state()
            events = run_cycle(state, now_ms(), dry_run=args.dry_run)
            save_state(state)
            print(
                "once: %d olay, %d oturum izleniyor"
                % (len(events), len(state.get("sessions") or {}))
            )
            return 0
        with open(PID_FILE, "w", encoding="utf-8") as fh:
            fh.write(str(os.getpid()))
        log("monitor basladi interval=%ds db=%s" % (interval, DB_PATH))
        state = load_state()
        while True:
            cycle_now = now_ms()
            try:
                run_cycle(state, cycle_now, dry_run=args.dry_run)
            except Exception as exc:
                log("dongu hatasi: %s" % notify.mask(exc), "ERROR")
            save_state(state)
            time.sleep(interval)
    except KeyboardInterrupt:
        log("monitor durduruldu (Ctrl+C)")
    finally:
        try:
            if os.path.exists(PID_FILE):
                os.remove(PID_FILE)
        except OSError:
            pass
        lock.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
