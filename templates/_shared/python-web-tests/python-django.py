import os
import unittest

import django
from django.test import Client

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()


class SiteTests(unittest.TestCase):
    def test_home_and_health(self):
        client = Client(headers={"host": "localhost"})
        self.assertEqual(client.get("/").status_code, 200)
        response = client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
