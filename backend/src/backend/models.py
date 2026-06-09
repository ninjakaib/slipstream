"""SQLAlchemy ORM models for SlipStream."""

import uuid
from datetime import datetime
from enum import StrEnum

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class VisibilityMode(StrEnum):
    ON = "on"
    FRIENDS_ONLY = "friends_only"
    GHOST = "ghost"


class SpeedUnit(StrEnum):
    MPH = "mph"
    KPH = "kph"


class FriendshipStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"


class ConvoyVisibility(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class ConvoyStatus(StrEnum):
    FORMING = "forming"
    ACTIVE = "active"
    ENDED = "ended"


class ConvoyMemberRole(StrEnum):
    LEADER = "leader"
    MEMBER = "member"


class JoinRequestStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class MessageType(StrEnum):
    TEXT = "text"
    SYSTEM = "system"
    QUICK_ACTION = "quick_action"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    apple_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    username: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    visibility: Mapped[VisibilityMode] = mapped_column(
        Enum(VisibilityMode, name="visibility_mode"),
        default=VisibilityMode.ON,
        server_default=VisibilityMode.ON.value,
    )
    discovery_radius_miles: Mapped[int] = mapped_column(
        Integer, default=15, server_default="15"
    )
    speed_unit: Mapped[SpeedUnit] = mapped_column(
        Enum(SpeedUnit, name="speed_unit"),
        default=SpeedUnit.MPH,
        server_default=SpeedUnit.MPH.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    cars: Mapped[list["Car"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    push_tokens: Mapped[list["PushToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    convoy_memberships: Mapped[list["ConvoyMember"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Car(Base):
    __tablename__ = "cars"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    year: Mapped[int] = mapped_column(Integer)
    make: Mapped[str] = mapped_column(String(100))
    model: Mapped[str] = mapped_column(String(100))
    trim: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str] = mapped_column(String(50))
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    mods: Mapped[list[str] | None] = mapped_column(
        ARRAY(Text), nullable=True, default=list
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="f")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="cars")


# Partial unique index: only one active car per user
Index(
    "ix_cars_one_active_per_user",
    Car.user_id,
    unique=True,
    postgresql_where=Car.is_active.is_(True),
)


class Friendship(Base):
    __tablename__ = "friendships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    addressee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[FriendshipStatus] = mapped_column(
        Enum(FriendshipStatus, name="friendship_status"),
        default=FriendshipStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])
    addressee: Mapped["User"] = relationship(foreign_keys=[addressee_id])

    __table_args__ = (
        Index(
            "ix_friendships_unique_pair",
            "requester_id",
            "addressee_id",
            unique=True,
        ),
    )


class Convoy(Base):
    __tablename__ = "convoys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(50))
    leader_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    visibility: Mapped[ConvoyVisibility] = mapped_column(
        Enum(ConvoyVisibility, name="convoy_visibility"),
        default=ConvoyVisibility.PUBLIC,
    )
    status: Mapped[ConvoyStatus] = mapped_column(
        Enum(ConvoyStatus, name="convoy_status"),
        default=ConvoyStatus.FORMING,
    )
    destination_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    destination_point = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    leader: Mapped["User"] = relationship(foreign_keys=[leader_id])
    members: Mapped[list["ConvoyMember"]] = relationship(
        back_populates="convoy", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ConvoyMessage"]] = relationship(
        back_populates="convoy", cascade="all, delete-orphan"
    )
    join_requests: Mapped[list["ConvoyJoinRequest"]] = relationship(
        back_populates="convoy", cascade="all, delete-orphan"
    )
    routes: Mapped[list["ConvoyRoute"]] = relationship(
        back_populates="convoy", cascade="all, delete-orphan"
    )


class ConvoyMember(Base):
    __tablename__ = "convoy_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    convoy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("convoys.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[ConvoyMemberRole] = mapped_column(
        Enum(ConvoyMemberRole, name="convoy_member_role"),
        default=ConvoyMemberRole.MEMBER,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    convoy: Mapped["Convoy"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="convoy_memberships")

    __table_args__ = (
        Index(
            "ix_convoy_members_unique",
            "convoy_id",
            "user_id",
            unique=True,
        ),
    )


class ConvoyJoinRequest(Base):
    __tablename__ = "convoy_join_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    convoy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("convoys.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[JoinRequestStatus] = mapped_column(
        Enum(JoinRequestStatus, name="join_request_status"),
        default=JoinRequestStatus.PENDING,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    convoy: Mapped["Convoy"] = relationship(back_populates="join_requests")
    user: Mapped["User"] = relationship()


class ConvoyMessage(Base):
    __tablename__ = "convoy_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    convoy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("convoys.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text)
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType, name="message_type"),
        default=MessageType.TEXT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    convoy: Mapped["Convoy"] = relationship(back_populates="messages")
    sender: Mapped["User | None"] = relationship()


class ConvoyRoute(Base):
    __tablename__ = "convoy_routes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    convoy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("convoys.id", ondelete="CASCADE"), index=True
    )
    set_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    destination_name: Mapped[str] = mapped_column(Text)
    destination_point = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=False
    )
    waypoints: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    route_geometry = mapped_column(
        Geography(geometry_type="LINESTRING", srid=4326), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="t")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    convoy: Mapped["Convoy"] = relationship(back_populates="routes")
    set_by: Mapped["User"] = relationship()


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="f")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class PushToken(Base):
    __tablename__ = "push_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    device_token: Mapped[str] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="push_tokens")
