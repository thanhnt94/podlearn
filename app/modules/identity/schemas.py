from marshmallow import Schema, fields

class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    username = fields.Str()
    email = fields.Str()
    full_name = fields.Str()
    avatar_url = fields.Str()
    role = fields.Str()
    is_admin = fields.Bool(dump_only=True)
    is_vip = fields.Bool(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
