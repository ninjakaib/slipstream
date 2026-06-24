"""Tests for auth endpoints (register, login, refresh, logout)."""

import pytest
from httpx import AsyncClient

from slipstream.models import User


@pytest.mark.asyncio
class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "username": "newuser",
            "password": "securepass123",
            "display_name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newuser"
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_register_duplicate_username(self, client: AsyncClient, test_user: User):
        resp = await client.post("/auth/register", json={
            "username": test_user.username,
            "password": "securepass123",
        })
        assert resp.status_code == 409

    async def test_register_invalid_username_too_short(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "username": "ab",
            "password": "securepass123",
        })
        assert resp.status_code == 422

    async def test_register_invalid_username_special_chars(self, client: AsyncClient):
        resp = await client.post("/auth/register", json={
            "username": "user@name!",
            "password": "securepass123",
        })
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user: User):
        resp = await client.post("/auth/login", json={
            "username": "testdriver",
            "password": "testpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testdriver"
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        resp = await client.post("/auth/login", json={
            "username": "testdriver",
            "password": "wrongpass",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/auth/login", json={
            "username": "nobody",
            "password": "whatever",
        })
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestRefresh:
    async def test_refresh_token_rotation(self, client: AsyncClient):
        # Register to get tokens
        reg_resp = await client.post("/auth/register", json={
            "username": "refreshuser",
            "password": "securepass123",
        })
        tokens = reg_resp.json()

        # Use refresh token
        resp = await client.post("/auth/refresh", json={
            "refresh_token": tokens["refresh_token"],
        })
        assert resp.status_code == 200
        new_tokens = resp.json()
        assert new_tokens["access_token"] != tokens["access_token"]
        assert new_tokens["refresh_token"] != tokens["refresh_token"]

        # Old refresh token should no longer work (rotation)
        resp2 = await client.post("/auth/refresh", json={
            "refresh_token": tokens["refresh_token"],
        })
        assert resp2.status_code == 401

    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post("/auth/refresh", json={
            "refresh_token": "totally-fake-token",
        })
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestProtectedEndpoints:
    async def test_no_token_rejected(self, client: AsyncClient):
        resp = await client.get("/users/me")
        assert resp.status_code in (401, 403)

    async def test_invalid_token_rejected(self, client: AsyncClient):
        resp = await client.get("/users/me", headers={
            "Authorization": "Bearer fake.invalid.token"
        })
        assert resp.status_code == 401

    async def test_valid_token_accepted(self, client: AsyncClient, test_user_token: str):
        resp = await client.get("/users/me", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testdriver"
