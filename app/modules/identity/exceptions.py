class IdentityError(Exception):
    pass

class UserNotFoundError(IdentityError):
    pass

class InvalidCredentialsError(IdentityError):
    pass
