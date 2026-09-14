"""
Django settings for config project (受付・入退室管理システム MVP).
"""

import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

_DEV_ONLY_SECRET_KEY = 'django-insecure-0#wgq0pvh$mht)_exf@k@rp2bb=vciemubo_j5o#vbio-u9rx6'

# Railway上で動いているかどうか（Railwayが自動で環境変数を注入する）。
# これを使って、本番では明示指定がなくても安全な既定値（DEBUG=False等）にする。
RAILWAY_PUBLIC_DOMAIN = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '')
IS_RAILWAY = bool(os.environ.get('RAILWAY_ENVIRONMENT_NAME') or RAILWAY_PUBLIC_DOMAIN)

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _DEV_ONLY_SECRET_KEY)
DEBUG = os.environ.get('DJANGO_DEBUG', 'False' if IS_RAILWAY else 'True') == 'True'

if not DEBUG and SECRET_KEY == _DEV_ONLY_SECRET_KEY:
    raise RuntimeError(
        'DEBUG=False で起動しようとしていますが DJANGO_SECRET_KEY が未設定です。'
        '本番環境（Railwayなど）では必ず環境変数 DJANGO_SECRET_KEY を設定してください。'
    )

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
    if host.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',')
    if origin.strip()
]
if RAILWAY_PUBLIC_DOMAIN:
    # Railwayが払い出すドメインを自動的に許可・信頼済みにする（毎回手動設定しなくて済むように）。
    ALLOWED_HOSTS.append(RAILWAY_PUBLIC_DOMAIN)
    CSRF_TRUSTED_ORIGINS.append(f'https://{RAILWAY_PUBLIC_DOMAIN}')

if IS_RAILWAY:
    # Railwayはリバースプロキシ経由でHTTPSを終端するため、これがないと
    # DjangoがHTTP接続だと誤認し、CSRF判定やリダイレクトがおかしくなる。
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'accounts',
    'members',
    'access',
    'cards',
    'orgsettings',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# DB優先順位: DATABASE_URL（RailwayのPostgresプラグインが自動注入） > SQLite（既定、ローカル開発用）
if os.environ.get('DATABASE_URL'):
    import dj_database_url

    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ['DATABASE_URL'],
            conn_max_age=600,
            ssl_require=IS_RAILWAY,
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'accounts.Staff'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'ja'
TIME_ZONE = 'Asia/Tokyo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# ビルド済みフロントエンド（frontend/dist）の場所。
# ローカル開発では Vite の dev サーバーを別途使うため、このディレクトリが無くても問題ない
# （本番の1サービス構成では、ここにある index.html / assets をこのDjangoサービスが配信する）。
FRONTEND_DIST_DIR = BASE_DIR.parent / 'frontend' / 'dist'
if FRONTEND_DIST_DIR.exists():
    # index.html以外の静的ファイル（assets/以下など）をサイト直下（Vite側のパスと同じ）で配信する。
    WHITENOISE_ROOT = FRONTEND_DIST_DIR

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173',
).split(',')
