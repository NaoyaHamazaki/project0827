from django.utils import timezone


def _build_sessions(logs):
    """created_at昇順のAccessLogを check_in -> check_out のペアに変換する。

    ScanView側のトグルロジックにより、会員ごとのtypeは本来厳密に交互になっている前提。
    末尾がcheck_inのみで終わる場合は「進行中セッション」としてcheck_out=Noneで返す。
    """
    sessions = []
    pending_check_in = None
    for log in logs:
        if log.type == log.LogType.CHECK_IN:
            pending_check_in = log
        elif log.type == log.LogType.CHECK_OUT and pending_check_in is not None:
            sessions.append((pending_check_in, log))
            pending_check_in = None
    if pending_check_in is not None:
        sessions.append((pending_check_in, None))
    return sessions


def calculate_usage(member, year=None, month=None):
    now = timezone.localtime(timezone.now())
    year = year or now.year
    month = month or now.month

    logs = member.access_logs.order_by('created_at')
    all_sessions = _build_sessions(logs)

    sessions = []
    total_seconds = 0.0
    for check_in, check_out in all_sessions:
        check_in_local = timezone.localtime(check_in.created_at)
        if check_in_local.year != year or check_in_local.month != month:
            continue
        end_time = check_out.created_at if check_out else timezone.now()
        duration_seconds = max((end_time - check_in.created_at).total_seconds(), 0)
        total_seconds += duration_seconds
        sessions.append({
            'check_in': check_in.created_at,
            'check_out': check_out.created_at if check_out else None,
            'duration_hours': round(duration_seconds / 3600, 1),
            'is_ongoing': check_out is None,
        })

    limit_hours = member.plan.monthly_hour_limit if member.plan else None
    used_hours = round(total_seconds / 3600, 1)
    remaining_hours = round(limit_hours - used_hours, 1) if limit_hours is not None else None

    return {
        'year': year,
        'month': month,
        'visit_count': len(sessions),
        'used_hours': used_hours,
        'limit_hours': limit_hours,
        'remaining_hours': remaining_hours,
        'plan_name': member.plan.name if member.plan else None,
        'sessions': sessions,
    }
