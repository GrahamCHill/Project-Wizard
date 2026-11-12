import unittest

from app import create_app


class AppTests(unittest.TestCase):
    def test_health(self):
        app = create_app()
        app.config["TESTING"] = True
        response = app.test_client().get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})
