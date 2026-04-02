"""Add SentenceSet and link Sentence to Set

Revision ID: d9a869c6c652
Revises: 723a96a8f359
Create Date: 2026-04-02 21:25:58.641676

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9a869c6c652'
down_revision = '723a96a8f359'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Ensure clean slate for sentence_sets
    op.execute('DROP TABLE IF EXISTS sentence_sets')
    
    # 2. Create sentence_sets table
    op.create_table('sentence_sets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('sentence_sets', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sentence_sets_user_id'), ['user_id'], unique=False)

    # 3. Add set_id to sentences (Temporarily Nullable to allow data migration)
    with op.batch_alter_table('sentences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('set_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_sentences_set_id'), ['set_id'], unique=False)
        batch_op.create_foreign_key(batch_op.f('fk_sentences_set_id_sentence_sets'), 'sentence_sets', ['set_id'], ['id'])

    # 4. DATA MIGRATION: Create default sets for all users who have sentences
    connection = op.get_bind()
    
    # Insert default sets
    connection.execute(sa.text(
        "INSERT INTO sentence_sets (user_id, title, description, created_at, updated_at) "
        "SELECT DISTINCT user_id, 'Bộ học tập cá nhân', 'Bộ mặc định chứa các câu cũ của bạn', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
        "FROM sentences"
    ))
    
    # Map sentences to their user's first set
    connection.execute(sa.text(
        "UPDATE sentences SET set_id = (SELECT id FROM sentence_sets WHERE sentence_sets.user_id = sentences.user_id LIMIT 1)"
    ))

    # 5. Enforce NOT NULL on set_id (Alembic handles this for SQLite by recreating the table)
    with op.batch_alter_table('sentences', schema=None) as batch_op:
        batch_op.alter_column('set_id', existing_type=sa.Integer(), nullable=False)


def downgrade():
    with op.batch_alter_table('sentences', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_sentences_set_id_sentence_sets'), type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_sentences_set_id'))
        batch_op.drop_column('set_id')

    op.drop_index(op.f('ix_sentence_sets_user_id'), table_name='sentence_sets')
    op.drop_table('sentence_sets')
