"""add_car_display_name

Revision ID: a1b2c3d4e5f6
Revises: 73dedd7af426
Create Date: 2026-06-10 23:18:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '73dedd7af426'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add display_name column to cars table.

    Per D-06: Display name decouples database identity (year/make/model) from
    how the car appears on map/profile (e.g., "R32 GT-R", "Panda AE86").
    """
    op.add_column(
        'cars',
        sa.Column('display_name', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """Remove display_name column from cars table."""
    op.drop_column('cars', 'display_name')
