import unittest

from httpx import ASGITransport, AsyncClient

from api import app


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")
        self.addAsyncCleanup(self.client.aclose)

    async def test_health(self):
        response = await self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    async def test_add(self):
        response = await self.client.post("/add", json={"left": 2, "right": 3})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"result": 5})
