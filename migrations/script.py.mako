"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, Sequence[str], None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Upgrade schema."""
    # =========================================================================
    # ECOSYSTEM MIGRATION GUIDELINE:
    # Always write IDEMPOTENT migrations. Check if a table/column exists before 
    # creating/adding it. This prevents crashes if the DB is in an out-of-sync state.
    # 
    # Example helper for table check:
    # conn = op.get_bind()
    # inspector = sa.inspect(conn)
    # tables = inspector.get_table_names()
    # if 'my_table' not in tables:
    #     op.create_table(...)
    # =========================================================================
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Downgrade schema."""
    ${downgrades if downgrades else "pass"}
