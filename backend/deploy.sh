#!/bin/sh
echo "=== deploy.sh START ==="

python manage.py migrate --noinput
python manage.py collectstatic --noinput || echo "[deploy] collectstatic 失敗（続行）"

echo "[deploy] gunicorn 起動"
exec gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --timeout 120 --workers 2
