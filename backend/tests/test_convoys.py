"""Tests for convoy endpoints."""

import pytest
from httpx import AsyncClient

from slipstream.models import User, Friendship


@pytest.mark.asyncio
class TestConvoys:
    async def test_create_convoy(self, client: AsyncClient, test_user_token: str):
        resp = await client.post("/convoys", json={
            "name": "Canyon Run",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Canyon Run"
        assert data["status"] == "forming"

    async def test_get_convoy(self, client: AsyncClient, test_user_token: str):
        # Create first
        create_resp = await client.post("/convoys", json={
            "name": "Test Convoy",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        convoy_id = create_resp.json()["id"]

        # Get it
        resp = await client.get(f"/convoys/{convoy_id}", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test Convoy"

    async def test_join_convoy_as_friend(
        self, client: AsyncClient, test_user_token: str,
        second_user_token: str, friends: Friendship
    ):
        # Create convoy as first user
        create_resp = await client.post("/convoys", json={
            "name": "Friend Convoy",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        convoy_id = create_resp.json()["id"]

        # Join as friend (second user)
        resp = await client.post(f"/convoys/{convoy_id}/join", headers={
            "Authorization": f"Bearer {second_user_token}"
        })
        assert resp.status_code == 200

    async def test_leave_convoy(
        self, client: AsyncClient, test_user_token: str,
        second_user_token: str, friends: Friendship
    ):
        # Create and join
        create_resp = await client.post("/convoys", json={
            "name": "Leave Test",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        convoy_id = create_resp.json()["id"]

        await client.post(f"/convoys/{convoy_id}/join", headers={
            "Authorization": f"Bearer {second_user_token}"
        })

        # Leave
        resp = await client.post(f"/convoys/{convoy_id}/leave", headers={
            "Authorization": f"Bearer {second_user_token}"
        })
        assert resp.status_code == 200

    async def test_end_convoy_leader_only(
        self, client: AsyncClient, test_user_token: str,
        second_user_token: str, friends: Friendship
    ):
        # Create convoy
        create_resp = await client.post("/convoys", json={
            "name": "End Test",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        convoy_id = create_resp.json()["id"]

        # Non-leader can't end it
        resp = await client.post(f"/convoys/{convoy_id}/end", headers={
            "Authorization": f"Bearer {second_user_token}"
        })
        assert resp.status_code == 403

        # Leader can end it
        resp = await client.post(f"/convoys/{convoy_id}/end", headers={
            "Authorization": f"Bearer {test_user_token}"
        })
        assert resp.status_code == 200

    async def test_user_can_only_be_in_one_convoy(
        self, client: AsyncClient, test_user_token: str
    ):
        # Create first convoy
        await client.post("/convoys", json={
            "name": "Convoy 1",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})

        # Try to create second — should fail (already in one)
        resp = await client.post("/convoys", json={
            "name": "Convoy 2",
            "visibility": "public",
        }, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (400, 409)
