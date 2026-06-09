"""Tests for friends endpoints."""

import pytest
from httpx import AsyncClient

from backend.models import User, Friendship


@pytest.mark.asyncio
class TestFriends:
    async def test_send_friend_request(
        self, client: AsyncClient, test_user_token: str, second_user: User
    ):
        resp = await client.post("/friends/request", json={
            "user_id": str(second_user.id),
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (200, 201)

    async def test_cannot_friend_self(
        self, client: AsyncClient, test_user_token: str, test_user: User
    ):
        resp = await client.post("/friends/request", json={
            "user_id": str(test_user.id),
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (400, 409)

    async def test_accept_friend_request(
        self, client: AsyncClient, test_user_token: str,
        second_user_token: str, test_user: User, second_user: User
    ):
        # Send request
        await client.post("/friends/request", json={
            "user_id": str(second_user.id),
        }, headers={"Authorization": f"Bearer {test_user_token}"})

        # Get pending requests as second user
        pending_resp = await client.get("/friends/requests", headers={
            "Authorization": f"Bearer {second_user_token}"
        })
        assert pending_resp.status_code == 200
        requests = pending_resp.json()
        assert len(requests) >= 1

        # Accept it
        request_id = requests[0]["id"]
        accept_resp = await client.post("/friends/accept", json={
            "request_id": request_id,
        }, headers={"Authorization": f"Bearer {second_user_token}"})
        assert accept_resp.status_code == 200

    async def test_list_friends(
        self, client: AsyncClient, test_user_token: str, friends: Friendship
    ):
        resp = await client.get("/friends", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    async def test_remove_friend(
        self, client: AsyncClient, test_user_token: str,
        second_user: User, friends: Friendship
    ):
        resp = await client.delete(f"/friends/{second_user.id}", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        assert resp.status_code == 200
