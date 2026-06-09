"""Cars/Garage router — manage vehicles in the user's garage."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.models import Car, User

router = APIRouter(prefix="/cars", tags=["cars"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CarResponse(BaseModel):
    id: str
    year: int
    make: str
    model: str
    trim: str | None = None
    color: str
    photo_url: str | None = None
    mods: list[str] | None = None
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


class CreateCarRequest(BaseModel):
    year: int = Field(ge=1900, le=2030)
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    trim: str | None = Field(default=None, max_length=100)
    color: str = Field(min_length=1, max_length=50)
    photo_url: str | None = None
    mods: list[str] | None = None


class UpdateCarRequest(BaseModel):
    year: int | None = Field(default=None, ge=1900, le=2030)
    make: str | None = Field(default=None, min_length=1, max_length=100)
    model: str | None = Field(default=None, min_length=1, max_length=100)
    trim: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, min_length=1, max_length=50)
    photo_url: str | None = None
    mods: list[str] | None = None


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _car_to_response(car: Car) -> CarResponse:
    return CarResponse(
        id=str(car.id),
        year=car.year,
        make=car.make,
        model=car.model,
        trim=car.trim,
        color=car.color,
        photo_url=car.photo_url,
        mods=car.mods,
        is_active=car.is_active,
        created_at=car.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=list[CarResponse])
async def list_cars(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CarResponse]:
    """List all cars in the current user's garage."""
    result = await db.execute(
        select(Car)
        .where(Car.user_id == current_user.id)
        .order_by(Car.is_active.desc(), Car.created_at.desc())
    )
    cars = result.scalars().all()
    return [_car_to_response(car) for car in cars]


@router.post("", response_model=CarResponse, status_code=status.HTTP_201_CREATED)
async def create_car(
    body: CreateCarRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CarResponse:
    """Add a new car to the garage.

    If this is the user's first car, it becomes the active car automatically.
    """
    # Check if user has any existing cars
    result = await db.execute(
        select(Car).where(Car.user_id == current_user.id).limit(1)
    )
    has_cars = result.scalar_one_or_none() is not None

    car = Car(
        user_id=current_user.id,
        year=body.year,
        make=body.make,
        model=body.model,
        trim=body.trim,
        color=body.color,
        photo_url=body.photo_url,
        mods=body.mods or [],
        is_active=not has_cars,  # First car is auto-activated
    )
    db.add(car)
    await db.flush()

    return _car_to_response(car)


@router.patch("/{car_id}", response_model=CarResponse)
async def update_car(
    car_id: uuid.UUID,
    body: UpdateCarRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CarResponse:
    """Update a car's details."""
    result = await db.execute(
        select(Car).where(Car.id == car_id, Car.user_id == current_user.id)
    )
    car = result.scalar_one_or_none()

    if car is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(car, field, value)

    await db.flush()
    return _car_to_response(car)


@router.delete("/{car_id}", response_model=MessageResponse)
async def delete_car(
    car_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Remove a car from the garage.

    Cannot delete the last car — users must always have at least one.
    If deleting the active car, another car is auto-activated.
    """
    result = await db.execute(
        select(Car).where(Car.id == car_id, Car.user_id == current_user.id)
    )
    car = result.scalar_one_or_none()

    if car is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found",
        )

    # Count user's cars
    count_result = await db.execute(
        select(Car.id).where(Car.user_id == current_user.id)
    )
    car_count = len(count_result.all())

    if car_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your only car. Add another car first.",
        )

    was_active = car.is_active
    await db.delete(car)

    # If we deleted the active car, activate another one
    if was_active:
        await db.flush()
        result = await db.execute(
            select(Car)
            .where(Car.user_id == current_user.id)
            .order_by(Car.created_at.desc())
            .limit(1)
        )
        next_car = result.scalar_one_or_none()
        if next_car is not None:
            next_car.is_active = True

    return MessageResponse(message="Car deleted")


@router.post("/{car_id}/activate", response_model=CarResponse)
async def activate_car(
    car_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CarResponse:
    """Set a car as the active car (shown on map and in profile)."""
    result = await db.execute(
        select(Car).where(Car.id == car_id, Car.user_id == current_user.id)
    )
    car = result.scalar_one_or_none()

    if car is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found",
        )

    if car.is_active:
        return _car_to_response(car)

    # Deactivate all other cars for this user
    await db.execute(
        update(Car)
        .where(Car.user_id == current_user.id, Car.id != car_id)
        .values(is_active=False)
    )

    # Activate this car
    car.is_active = True
    await db.flush()

    return _car_to_response(car)
