import os
from abc import ABC, abstractmethod
from flask import url_for

class StorageProvider(ABC):
    """
    Abstract Interface for Storage Providers.
    """
    @abstractmethod
    def save(self, file_data, filename, folder=None):
        """Saves file and returns the identifier (URL or path)."""
        pass

    @abstractmethod
    def get_url(self, filename, folder=None):
        """Returns the public URL for the file."""
        pass

    @abstractmethod
    def delete(self, filename, folder=None):
        """Deletes the file from storage."""
        pass

class LocalStorageProvider(StorageProvider):
    """
    Storage Provider using the local filesystem (custom media folder).
    """
    def __init__(self, base_folder):
        self.base_folder = base_folder

    def _get_abs_path(self, filename, folder=None):
        base_path = self.base_folder
        if folder:
            base_path = os.path.join(base_path, folder)
        return os.path.join(base_path, filename)

    def save(self, file_data, filename, folder=None):
        abs_path = self._get_abs_path(filename, folder)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        
        # In this implementation, file_data could be bytes or a local temp file path
        if isinstance(file_data, bytes):
            with open(abs_path, 'wb') as f:
                f.write(file_data)
        else:
            # Assume it's a file path if not bytes (e.g., from pydub export)
            import shutil
            shutil.copy(file_data, abs_path)
            
        return self.get_url(filename, folder)

    def get_url(self, filename, folder=None):
        path = filename
        if folder:
            # Ensure folder is forward-slash for URLs
            path = f"{folder.replace(os.sep, '/')}/{filename}"
        
        # Point to the custom /media/ route
        return url_for('serve_media', filename=path)

    def delete(self, filename, folder=None):
        abs_path = self._get_abs_path(filename, folder)
        if os.path.exists(abs_path):
            os.remove(abs_path)

class S3StorageProvider(StorageProvider):
    """
    Skeleton for S3 Storage Provider using boto3.
    """
    def __init__(self, bucket_name, access_key=None, secret_key=None, region=None):
        self.bucket_name = bucket_name
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        # self.s3 = boto3.client(...)

    def save(self, file_data, filename, folder=None):
        # Implementation for s3.upload_fileobj(...)
        key = f"{folder}/{filename}" if folder else filename
        print(f"[S3] Mock upload: {key} to bucket {self.bucket_name}")
        return self.get_url(filename, folder)

    def get_url(self, filename, folder=None):
        key = f"{folder}/{filename}" if folder else filename
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"

    def delete(self, filename, folder=None):
        # Implementation for s3.delete_object(...)
        key = f"{folder}/{filename}" if folder else filename
        print(f"[S3] Mock delete: {key} from bucket {self.bucket_name}")
