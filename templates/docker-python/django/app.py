import os
import secrets
import sys

from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.http import JsonResponse
from django.urls import path


if not settings.configured:
    settings.configure(
        ROOT_URLCONF="app",
        SECRET_KEY=os.getenv("DJANGO_SECRET_KEY") or secrets.token_urlsafe(48),
        ALLOWED_HOSTS=os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(","),
        DEBUG=False,
    )


def health(request):
    return JsonResponse({"status": "ok"})


def hello(request):
    name = request.GET.get("name") or "world"
    return JsonResponse({"message": f"Hello, {name}!"})


urlpatterns = [path("healthz", health), path("hello", hello)]
application = get_wsgi_application()

if __name__ == "__main__":
    os.execvp(sys.executable, [sys.executable, "-m", "gunicorn", "--bind", f"0.0.0.0:{os.getenv('PORT', '8080')}", "app:application"])
