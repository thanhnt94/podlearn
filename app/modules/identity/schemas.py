from marshmallow import Schema, fields

class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    username = fields.Str()
    email = fields.Str()
    full_name = fields.Str()
    avatar_url = fields.Str()
    role = fields.Str()
    created_at = fields.DateTime(dump_only=True)
