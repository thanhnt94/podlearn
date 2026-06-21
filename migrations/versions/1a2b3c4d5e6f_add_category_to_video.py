"""Add category to Video

Revision ID: 1a2b3c4d5e6f
Revises: 
Create Date: 2026-05-31 01:51:30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # =========================================================================
    # ECOSYSTEM MIGRATION GUIDELINE:
    # Always write IDEMPOTENT migrations. Check if a table/column exists before 
    # creating/adding it. This prevents crashes if the DB is in an out-of-sync state.
    # =========================================================================
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('videos')]
    if 'category' not in columns:
        op.add_column('videos', sa.Column('category', sa.String(length=50), nullable=True, server_default='podcast'))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('videos')]
    if 'category' in columns:
        # Note: SQLite may not fully support dropping columns, but standard alembic is:
        with op.batch_alter_table('videos') as batch_op:
            batch_op.drop_column('category')
