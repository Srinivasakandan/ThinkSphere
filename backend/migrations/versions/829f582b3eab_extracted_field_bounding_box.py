"""extracted field bounding box

Revision ID: 829f582b3eab
Revises: ccc51659abe8
Create Date: 2026-09-16 15:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "829f582b3eab"
down_revision: str | None = "ccc51659abe8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("extracted_fields", sa.Column("bounding_box", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("extracted_fields", "bounding_box")
