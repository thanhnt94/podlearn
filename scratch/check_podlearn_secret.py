import os
from dotenv import load_dotenv

load_dotenv('c:/Code/Ecosystem/PodLearn/.env')
print(f"Secret: {os.environ.get('CENTRAL_AUTH_CLIENT_SECRET')}")
