"""Tests for cars (garage) endpoints."""

import pytest
from httpx import AsyncClient

from backend.models import User, Car


@pytest.mark.asyncio
class TestCars:
    async def test_add_car(self, client: AsyncClient, test_user_token: str):
        resp = await client.post("/cars", json={
            "year": 2020,
            "make": "Toyota",
            "model": "Supra",
            "trim": "3.0 Premium",
            "color": "#FF6600",
            "mods": ["catback exhaust", "tune"],
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["make"] == "Toyota"
        assert data["model"] == "Supra"
        assert data["is_active"] is True  # First car should auto-activate

    async def test_list_cars(self, client: AsyncClient, test_user_token: str):
        # Add a car first
        await client.post("/cars", json={
            "year": 2019,
            "make": "Honda",
            "model": "Civic Type R",
            "color": "#FFFFFF",
        }, headers={"Authorization": f"Bearer {test_user_token}"})

        resp = await client.get("/cars", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    async def test_update_car(self, client: AsyncClient, test_user_token: str):
        # Add car
        create_resp = await client.post("/cars", json={
            "year": 2020,
            "make": "Toyota",
            "model": "Supra",
            "color": "#FF6600",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        car_id = create_resp.json()["id"]

        # Update it
        resp = await client.patch(f"/cars/{car_id}", json={
            "color": "#000000",
            "mods": ["turbo upgrade", "intercooler"],
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 200
        assert resp.json()["color"] == "#000000"

    async def test_cannot_delete_only_car(self, client: AsyncClient, test_user_token: str):
        # Add single car
        create_resp = await client.post("/cars", json={
            "year": 2020,
            "make": "Toyota",
            "model": "Supra",
            "color": "#FF6600",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        car_id = create_resp.json()["id"]

        # Try to delete — should fail (must keep at least one)
        resp = await client.delete(f"/cars/{car_id}", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        # Implementation may return 400 or 409
        assert resp.status_code in (400, 409)
